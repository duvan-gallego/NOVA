import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const certDir = join(rootDir, "frontend", "certs");
const certPath = join(certDir, "nova-dev.crt");
const keyPath = join(certDir, "nova-dev.key");
const configPath = join(certDir, "nova-dev-openssl.cnf");

mkdirSync(certDir, { recursive: true });

const localIps = Object.values(networkInterfaces())
  .flat()
  .filter((item) => item?.family === "IPv4" && !item.internal)
  .map((item) => item.address);

const altNames = ["DNS.1 = localhost", "IP.1 = 127.0.0.1", ...localIps.map((ip, index) => `IP.${index + 2} = ${ip}`)];

writeFileSync(
  configPath,
  `
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = NOVA local development

[v3_req]
subjectAltName = @alt_names

[alt_names]
${altNames.join("\n")}
`.trimStart(),
);

if (existsSync(certPath) && existsSync(keyPath)) {
  console.log("NOVA development certificate already exists.");
  console.log(certPath);
  process.exit(0);
}

const result = spawnSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "825",
    "-keyout",
    keyPath,
    "-out",
    certPath,
    "-config",
    configPath,
  ],
  { stdio: "inherit" },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Created NOVA development certificate:");
console.log(certPath);
console.log("Install and trust this certificate on the iPad if Safari says the connection is not private.");
