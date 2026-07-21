import { db } from "./src/index.js"

async function main() {
  const res = await db.query.bugReport.findFirst({
    where: (bugReport, { eq }) => eq(bugReport.id, "UhK38F6DQpkf")
  })
  console.log(res)
  process.exit(0)
}

main()
