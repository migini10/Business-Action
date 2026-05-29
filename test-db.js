require("dotenv").config({ path: ".env.local" });
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
prisma.dossier.findFirst({ orderBy: { createdAt: "desc" } }).then(d => {
  console.log("Recto:", d?.rectoUrl);
  console.log("Verso:", d?.versoUrl);
}).catch(console.error).finally(() => prisma.$disconnect());
