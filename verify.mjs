import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Check each fixture record
  const checks = [
    { name: "Owner user", model: prisma.user, id: "URWYhXMYYTvYHBlrShOVn0uhvfBD7n7h" },
    { name: "Nominee user", model: prisma.user, id: "qckk8q79XGsX5f9QBOKkdSv1H1QGeEcK" },
    { name: "P1 Fixture Asset", model: prisma.asset, id: "70cba38e-56df-47ea-ad06-af8ab8a19e6e" },
    { name: "InheritanceRequest (nominee contact)", model: prisma.inheritanceRequest, id: "5aeaf346-3801-46a1-983d-9480509bd0e4" }
  ];
  
  for (const check of checks) {
    const record = await check.model.findUnique({ where: { id: check.id } });
    console.log(`${check.name}: ${record ? "FOUND" + (record.id ? " id=" + record.id : "") : "NOT FOUND"}`);
    if (record) {
      if (check.model === prisma.user) {
        console.log(`  Email: ${record.email}`);
      } else if (check.model === prisma.asset) {
        console.log(`  Name: ${record.name}, OwnerId: ${record.ownerId}`);
      } else if (check.model === prisma.inheritanceRequest) {
        console.log(`  AssetId: ${record.assetId}, NomineeId: ${record.nomineeId}, Status: ${record.status}`);
      }
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });