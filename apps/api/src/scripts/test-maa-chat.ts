import { answerMaaChat } from "../services/maa-chat.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const locale = args.includes("--fr")
    ? "fr-CA"
    : args.includes("--en")
      ? "en-CA"
      : undefined;

  const userMessage = args
    .filter((arg) => arg !== "--fr" && arg !== "--en")
    .join(" ")
    .trim();

  if (!userMessage) {
    throw new Error(
      'Please provide a question, for example: pnpm --filter @platform/api test:maa:chat -- "What are the membership fees?"',
    );
  }

  const result = await answerMaaChat({
    userMessage,
    locale,
    maxResults: 5,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});