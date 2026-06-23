import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

interface Env {
  RUME_STATE: KVNamespace;
}

const ROOM_SIZE = 360;
const DOOR_DEADZONE = { x: 330, y: 330, width: 60, height: 60 };

function checkOverlap(a: any, b: any) {
  return !(
    a.x + a.width / 2 < b.x - b.width / 2 ||
    a.x - a.width / 2 > b.x + b.width / 2 ||
    a.y + a.height / 2 < b.y - b.height / 2 ||
    a.y - a.height / 2 > b.y + b.height / 2
  );
}

function randomFurniture() {
  const bed = { name: "Bed", width: 140, height: 210, x: 0, y: 0, angle: 0 };
  const sideTable = { name: "SideTable", width: 40, height: 40, x: 0, y: 0, angle: 0 };
  const tvTable = { name: "TVTable", width: 180, height: 40, x: 0, y: 0, angle: 0 };

  for (let i = 0; i < 1000; i++) {
    const a = Math.random() > 0.5 ? 0 : 90;
    if (a === 0) {
      bed.x = bed.width / 2 + Math.random() * (ROOM_SIZE - bed.width);
      bed.y = bed.height / 2 + Math.random() * (ROOM_SIZE - bed.height);
    } else {
      bed.x = bed.height / 2 + Math.random() * (ROOM_SIZE - bed.height);
      bed.y = bed.width / 2 + Math.random() * (ROOM_SIZE - bed.width);
    }
    bed.angle = a;
    if (!checkOverlap(bed, DOOR_DEADZONE)) break;
  }

  for (let i = 0; i < 1000; i++) {
    sideTable.x = sideTable.width / 2 + Math.random() * (ROOM_SIZE - sideTable.width);
    sideTable.y = sideTable.height / 2 + Math.random() * (ROOM_SIZE - sideTable.height);
    if (!checkOverlap(sideTable, bed) && !checkOverlap(sideTable, DOOR_DEADZONE)) break;
  }

  for (let i = 0; i < 1000; i++) {
    const a = Math.random() > 0.5 ? 0 : 90;
    if (a === 0) {
      tvTable.x = tvTable.width / 2 + Math.random() * (ROOM_SIZE - tvTable.width);
      tvTable.y = tvTable.height / 2 + Math.random() * (ROOM_SIZE - tvTable.height);
    } else {
      tvTable.x = tvTable.height / 2 + Math.random() * (ROOM_SIZE - tvTable.height);
      tvTable.y = tvTable.width / 2 + Math.random() * (ROOM_SIZE - tvTable.width);
    }
    tvTable.angle = a;
    if (!checkOverlap(tvTable, bed) && !checkOverlap(tvTable, sideTable) && !checkOverlap(tvTable, DOOR_DEADZONE)) break;
  }

  return [bed, sideTable, tvTable];
}

function randomLights(furniture: any[]) {
  const lights: any[] = [];
  const num = Math.floor(Math.random() * 4) + 4;
  const sideTable = furniture.find(f => f.name === "SideTable");
  const seedX = sideTable ? sideTable.x : 60 + Math.random() * 240;
  const seedY = sideTable ? sideTable.y : 60 + Math.random() * 240;

  for (let i = 0; i < num; i++) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const r = [5, 7.5, 10][Math.floor(Math.random() * 3)];
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 50;
      const x = seedX + Math.cos(angle) * dist;
      const y = seedY + Math.sin(angle) * dist;
      if (x - r < 0 || x + r > ROOM_SIZE || y - r < 0 || y + r > ROOM_SIZE) continue;
      let hit = furniture.some(f => checkOverlap({ x, y, width: r * 2, height: r * 2 }, f));
      if (hit) continue;
      let lightHit = lights.some(l => Math.hypot(x - l.x, y - l.y) < r + l.r + 2);
      if (lightHit) continue;
      lights.push({ x, y, r });
      break;
    }
  }
  return lights;
}

function createServer(env: Env) {
  const server = new McpServer({ name: "rume-mood-lamp", version: "1.0.0" });

  server.tool("rearrange_furniture", "침실의 가구를 새로운 위치로 재배치하고 조명을 초기화합니다.", {}, async () => {
    const furniture = randomFurniture();
    const state = { furniture, lights: [], lightsPlaced: false };
    await env.RUME_STATE.put("state", JSON.stringify(state));
    return { content: [{ type: "text", text: JSON.stringify(state) }] };
  });

  server.tool("place_lights", "발광버섯 조명 군락을 현재 가구 배치에 맞게 새로 배치합니다.", {}, async () => {
    const raw = await env.RUME_STATE.get("state");
    const state = raw ? JSON.parse(raw) : { furniture: randomFurniture(), lights: [], lightsPlaced: false };
    state.lights = randomLights(state.furniture);
    state.lightsPlaced = true;
    await env.RUME_STATE.put("state", JSON.stringify(state));
    return { content: [{ type: "text", text: JSON.stringify(state) }] };
  });

  server.tool("shuffle_lights", "조명 위치를 다시 섞어 새로운 군락 배치를 만듭니다.", {}, async () => {
    const raw = await env.RUME_STATE.get("state");
    const state = raw ? JSON.parse(raw) : { furniture: randomFurniture(), lights: [], lightsPlaced: false };
    state.lights = randomLights(state.furniture);
    state.lightsPlaced = true;
    await env.RUME_STATE.put("state", JSON.stringify(state));
    return { content: [{ type: "text", text: JSON.stringify(state) }] };
  });

  server.tool("get_order_summary", "현재 배치된 조명의 사이즈별 수량과 금액을 반환합니다.", {}, async () => {
    const raw = await env.RUME_STATE.get("state");
    const state = raw ? JSON.parse(raw) : null;
    if (!state || !state.lightsPlaced) {
      return { content: [{ type: "text", text: "조명이 아직 배치되지 않았습니다." }] };
    }
    const prices: Record<number, number> = { 5: 49000, 7.5: 69000, 10: 89000 };
    const labels: Record<number, string> = { 5: "소형(지름 10cm)", 7.5: "중형(지름 15cm)", 10: "대형(지름 20cm)" };
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

  return server;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/state") {
      const val = await env.RUME_STATE.get("state");
      return new Response(val ?? "{}", {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (url.pathname === "/mcp") {
      const server = createServer(env);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      return transport.handleRequest(request, {});
    }

    return new Response("Not found", { status: 404 });
  },
};