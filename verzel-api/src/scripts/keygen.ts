/** Gera segredos novos para o .env (ou para as variáveis do Render). */
import crypto from "node:crypto";

const random = () => crypto.randomBytes(32).toString("hex");

console.log(`JWT_SECRET=${random()}`);
console.log(`ALIAS_SECRET=${random()}`);
console.log(`SIGNING_KEY_SEED=${random()}`);
