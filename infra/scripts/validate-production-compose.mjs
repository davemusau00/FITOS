import process from "node:process";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const config = JSON.parse(input);

for (const serviceName of ["postgres", "redis", "api", "worker"]) {
  const service = config.services?.[serviceName];
  if (!service) throw new Error(`Production Compose is missing ${serviceName}.`);
  if (service.ports?.length) {
    throw new Error(`${serviceName} must not publish host ports in production.`);
  }
}

const nginxPorts = config.services?.nginx?.ports ?? [];
const published = new Set(nginxPorts.map((port) => Number(port.published)));
if (!published.has(80) || !published.has(443)) {
  throw new Error("Production Nginx must publish ports 80 and 443.");
}

process.stdout.write('{"event":"production_compose.network_boundary_validated"}\n');
