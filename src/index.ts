import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface Env {
  RUME_STATE: KVNamespace;
  MCP_OBJECT: DurableObjectNamespace;
}

// ==========================================
// 1. complete.html에서 그대로 복사한 상수 및 설정
// ==========================================
const ROOM_SIZE = 360;

const FURNITURE_DATA = {
  bed:       { width: 140, height: 210, name: 'Bed' },
  sideTable: { width: 40,  height: 40,  name: 'SideTable' },
  tvTable:   { width: 180, height: 40,  name: 'TVTable' }
};

const LIGHT_RADII = [5, 7.5, 10];
const DOOR_DEADZONE = { x: 330, y: 330, width: 60, height: 60, angle: 0 };

// ==========================================
// 2. complete.html에서 복사한 정밀 기하학 알고리즘
// ==========================================
function getVertices(item: any) {
  const rad = (item.angle * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const hw = item.width / 2, hh = item.height / 2;
  return [
    {x: -hw, y: -hh}, {x: hw, y: -hh}, {x: hw, y: hh}, {x: -hw, y: hh}
  ].map(v => ({
    x: item.x + (v.x * cos - v.y * sin),
    y: item.y + (v.x * sin + v.y * cos)
  }));
}

function checkOverlapRect(rA: any, rB: any): boolean {
  const axes = (verts: any[]) => {
    const ax = [];
    for (let i = 0; i < verts.length; i++) {
      const p1 = verts[i], p2 = verts[(i+1) % verts.length];
      const ex = p2.x - p1.x, ey = p2.y - p1.y;
      ax.push({x: -ey, y: ex});
    }
    return ax;
  };
  const project = (verts: any[], axis: any) => {
    let mn = Infinity, mx = -Infinity;
    for (const p of verts) {
      const d = p.x * axis.x + p.y * axis.y;
      if (d < mn) mn = d; if (d > mx) mx = d;
    }
    return {mn, mx};
  };
  const vA = getVertices(rA), vB = getVertices(rB);
  for (const axis of [...axes(vA), ...axes(vB)]) {
    const pA = project(vA, axis), pB = project(vB, axis);
    if (pA.mx < pB.mn || pB.mx < pA.mn) return false;
  }
  return true;
}

function isCircleFullyInRect(cx: number, cy: number, r: number, rect: any): boolean {
  const rad = (-rect.angle * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = cx - rect.x, dy = cy - rect.y;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return (Math.abs(lx) <= rect.width/2 - r &&
          Math.abs(ly) <= rect.height/2 - r);
}

function isCircleOverlapRect(cx: number, cy: number, r: number, rect: any): boolean {
  const rad = (-rect.angle * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = cx - rect.x, dy = cy - rect.y;
  const lx = Math.abs(dx * cos - dy * sin);
  const ly = Math.abs(dx * sin + dy * cos);
  const hw = rect.width / 2, hh = rect.height / 2;
  if (lx > hw + r || ly > hh + r) return false;
  if (lx <= hw || ly <= hh) return true;
  return (lx - hw) ** 2 + (ly - hh) ** 2 <= r * r;
}

function isCircleOverlapDoorArc(cx: number, cy: number, r: number): boolean {
  const pivotX = 360, pivotY = 300, arcR = 60;
  if (cx > pivotX || cy < pivotY) return false;
  const dist = Math.hypot(cx - pivotX, cy - pivotY);
  return dist < arcR + r;
}

// ==========================================
// 3. 버튼 기능 연동용 핵심 비즈니스 로직
// ==========================================

// [가구 재배치 버튼] 동작 로직
function layoutRulesFurniture(): any[] {
  const placedFurniture: any[] = [];

  // 1. 침대 배치
  let bed: any = null;
  for (let attempt = 0; attempt < 300; attempt++) {
    const wallIdx = Math.floor(Math.random() * 4);
    const walls = ['NORTH','SOUTH','EAST','WEST'];
    const wall = walls[wallIdx];
    const bw = FURNITURE_DATA.bed.width;
    const bh = FURNITURE_DATA.bed.height;
    let b = { width: bw, height: bh, angle: 0, name: 'Bed', x: 0, y: 0 };

    if (wall === 'NORTH') {
      b.angle = 0; b.x = bw/2 + Math.random() * (ROOM_SIZE - bw); b.y = bh/2;
    } else if (wall === 'SOUTH') {
      b.angle = 180; b.x = bw/2 + Math.random() * (ROOM_SIZE - bw); b.y = ROOM_SIZE - bh/2;
    } else if (wall === 'WEST') {
      b.angle = 270; b.x = bh/2; b.y = bw/2 + Math.random() * (ROOM_SIZE - bw);
    } else { 
      b.angle = 90; b.x = ROOM_SIZE - bh/2; b.y = bw/2 + Math.random() * (ROOM_SIZE - bw);
    }
    if (!checkOverlapRect(b, DOOR_DEADZONE)) {
      bed = b;
      break;
    }
  }
  if (!bed) bed = { x: 70, y: 105, width: 140, height: 210, angle: 0, name: 'Bed' };
  placedFurniture.push(bed);

  // 2. 협탁 고도화 알고리즘 (머리맡 기준 배치)
  let sideSide = 1;
  if (bed.angle === 0) {
    sideSide = (bed.x > ROOM_SIZE - bed.x) ? -1 : 1; 
  } else if (bed.angle === 180) {
    sideSide = (bed.x < ROOM_SIZE - bed.x) ? -1 : 1;
  } else if (bed.angle === 270) {
    sideSide = (bed.y < ROOM_SIZE - bed.y) ? -1 : 1;
  } else if (bed.angle === 90) {
    sideSide = (bed.y > ROOM_SIZE - bed.y) ? -1 : 1;
  }

  const rad = (bed.angle * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const st = FURNITURE_DATA.sideTable;
  const offY = -bed.height/2 + st.height/2; 
  const offX = bed.width/2 + st.width/2;

  const lx = sideSide * offX;
  let sx = bed.x + (lx * cos - offY * sin);
  let sy = bed.y + (lx * sin + offY * cos);
  const sideTable = { width: st.width, height: st.height, angle: bed.angle, name: 'SideTable', x: sx, y: sy };

  if (sx < 0 || sx > ROOM_SIZE || sy < 0 || sy > ROOM_SIZE || checkOverlapRect(sideTable, DOOR_DEADZONE)) {
    const altLx = -sideSide * offX;
    sideTable.x = bed.x + (altLx * cos - offY * sin);
    sideTable.y = bed.y + (altLx * sin + offY * cos);
  }
  placedFurniture.push(sideTable);

  // 3. TV 테이블 배치
  const tv = FURNITURE_DATA.tvTable;
  for (let attempt = 0; attempt < 400; attempt++) {
    const wall = ['NORTH','SOUTH','EAST','WEST'][Math.floor(Math.random() * 4)];
    let t = { width: tv.width, height: tv.height, angle: 0, name: 'TVTable', x: 0, y: 0 };
    if (wall === 'NORTH') {
      t.angle = 0; t.x = tv.width/2 + Math.random()*(ROOM_SIZE-tv.width); t.y = tv.height/2;
    } else if (wall === 'SOUTH') {
      t.angle = 0; t.x = tv.width/2 + Math.random()*(ROOM_SIZE-tv.width); t.y = ROOM_SIZE - tv.height/2;
    } else if (wall === 'WEST') {
      t.angle = 90; t.x = tv.height/2; t.y = tv.width/2 + Math.random()*(ROOM_SIZE-tv.width);
    } else {
      t.angle = 90; t.x = ROOM_SIZE - tv.height/2; t.y = tv.width/2 + Math.random()*(ROOM_SIZE-tv.width);
    }
    
    if (!checkOverlapRect(t, bed) && !checkOverlapRect(t, sideTable) && !checkOverlapRect(t, DOOR_DEADZONE)) {
      placedFurniture.push(t);
      break;
    }
  }

  return placedFurniture;
}

// [조명 배치 / Shuffle 버튼] 동작 로직
function randomizeLights(furniture: any[]): any[] {
  const placedLights: any[] = [];
  const numLights = Math.floor(Math.random() * 4) + 4; 

  const sideTable = furniture.find(f => f.name === 'SideTable');
  let seedX: number, seedY: number;
  if (sideTable && Math.random() > 0.4) {
    seedX = sideTable.x; seedY = sideTable.y;
  } else {
    seedX = 60 + Math.random() * 240;
    seedY = 60 + Math.random() * 240;
  }

  for (let i = 0; i < numLights; i++) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const r = LIGHT_RADII[Math.floor(Math.random() * LIGHT_RADII.length)];
      const angle  = Math.random() * Math.PI * 2;
      const dist   = Math.random() * 50;
      const x = seedX + Math.cos(angle) * dist;
      const y = seedY + Math.sin(angle) * dist;

      if (x - r < 0 || x + r > ROOM_SIZE || y - r < 0 || y + r > ROOM_SIZE) continue;
      if (isCircleOverlapDoorArc(x, y, r)) continue;

      let onSideTable = false;
      if (sideTable) {
        onSideTable = isCircleFullyInRect(x, y, r, sideTable);
      }

      if (!onSideTable) {
        let hit = false;
        for (const pf of furniture) {
          if (isCircleOverlapRect(x, y, r, pf)) { hit = true; break; }
        }
        if (hit) continue;
      }

      let lightHit = false;
      for (const pl of placedLights) {
        if (Math.hypot(x - pl.x, y - pl.y) < r + pl.r + 2) { lightHit = true; break; }
      }
      if (lightHit) continue;

      placedLights.push({ x, y, r });
      break;
    }
  }
  return placedLights;
}

// ==========================================
// 4. MCP 서버 구현 및 상태 관리
// ==========================================
export class RumeMCP extends McpAgent {
  server = new McpServer({ name: "rume-mood-lamp", version: "1.0.0" });

  async init() {
    // 가구 재배치 도면 도구
    this.server.tool("rearrange_furniture", "침실의 가구를 새로운 위치로 재배치하고 조명을 초기화합니다.", {}, async () => {
      const furniture = layoutRulesFurniture();
      const state = { furniture, lights: [], lightsPlaced: false };
      await (this.env as Env).RUME_STATE.put("state", JSON.stringify(state));
      return { content: [{ type: "text", text: JSON.stringify(state) }] };
    });

    // 조명 초기 배치 도구
    this.server.tool("place_lights", "발광버섯 조명 군락을 현재 가구 배치에 맞게 새로 배치합니다.", {}, async () => {
      const raw = await (this.env as Env).RUME_STATE.get("state");
      const state = raw ? JSON.parse(raw) : { furniture: layoutRulesFurniture(), lights: [], lightsPlaced: false };
      state.lights = randomizeLights(state.furniture);
      state.lightsPlaced = true;
      await (this.env as Env).RUME_STATE.put("state", JSON.stringify(state));
      return { content: [{ type: "text", text: JSON.stringify(state) }] };
    });

    // 조명 셔플 도구
    this.server.tool("shuffle_lights", "조명 위치를 다시 섞어 새로운 군락 배치를 만듭니다.", {}, async () => {
      const raw = await (this.env as Env).RUME_STATE.get("state");
      const state = raw ? JSON.parse(raw) : { furniture: layoutRulesFurniture(), lights: [], lightsPlaced: false };
      state.lights = randomizeLights(state.furniture);
      state.lightsPlaced = true;
      await (this.env as Env).RUME_STATE.put("state", JSON.stringify(state));
      return { content: [{ type: "text", text: JSON.stringify(state) }] };
    });

    // [구매하기 버튼] 영수증 정산 도구
    this.server.tool("get_order_summary", "현재 배치된 조명의 사이즈별 수량과 금액을 반환합니다.", {}, async () => {
      const raw = await (this.env as Env).RUME_STATE.get("state");
      const state = raw ? JSON.parse(raw) : null;
      if (!state || !state.lightsPlaced) {
        return { content: [{ type: "text", text: "조명이 아직 배치되지 않았습니다." }] };
      }
      const prices: Record<number, number> = { 5: 49000, 7.5: 69000, 10: 89000 };
      const labels: Record<number, string> = { 5: "소형 (지름 10cm)", 7.5: "중형 (지름 15cm)", 10: "대형 (지름 20cm)" };
      const counts: Record<number, number> = { 5: 0, 7.5: 0, 10: 0 };
      state.lights.forEach((l: any) => { if (counts[l.r] !== undefined) counts[l.r]++; });
      
      let total = 0;
      const items = Object.entries(counts)
        .filter(([, c]) => c > 0)
        .map(([r, c]) => {
          const price = prices[Number(r)] * (c as number);
          total += price;
          return { label: labels[Number(r)], count: c, price };
        });
      return { content: [{ type: "text", text: JSON.stringify({ items, total }) }] };
    });
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      return RumeMCP.serve("/mcp").fetch(request, env, ctx);
    }

    if (url.pathname === "/state") {
      return env.RUME_STATE.get("state").then(val =>
        new Response(val ?? "{}", {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        })
      );
    }

    return new Response("Not found", { status: 404 });
  },
};