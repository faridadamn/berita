import bcrypt from "bcryptjs";
const pw = process.argv[2];
if (!pw) {
  console.error("Pakai: npm run hash -- passwordkamu");
  process.exit(1);
}
bcrypt.hash(pw, 10).then((h) => {
  console.log(h);
  console.log("\nUntuk .env (escape $):");
  console.log("ADMIN_PASSWORD_HASH=" + h.replace(/\$/g, "\\$"));
});
