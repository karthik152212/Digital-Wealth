import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const owner = await prisma.user.findUnique({ where: { id: "URWYhXMYYTvYHBlrShOVn0uhvfBD7n7h" } });
  console.log("Owner:", owner ? owner.email : "NOT FOUND");
  const nominee = await prisma.user.findUnique({ where: { id: "qckk8q79XGsX5f9QBOKkdSv1H1QGeEcK" } });
  console.log("Nominee:", nominee ? nominee.email : "NOT FOUND");
  const asset = await prisma.asset.findUnique({ where: { id: "70cba38e-56df-47ea-ad06-af8ab8a19e6e" } });
  console.log("Asset:", asset ? asset.name : "NOT FOUND");
  const req = await prisma.inheritanceRequest.findUnique({ where: { id: "5aeaf346-3801-46a1-983d-9480509bd0e4" } });
  console.log("Request:", req ? "FOUND" : "NOT FOUND");
}
main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });