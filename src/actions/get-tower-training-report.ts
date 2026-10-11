import { createApp } from "../di.ts";

export async function handleTowerTrainingReport() {
  return (await createApp()).getTowerTrainingReport();
}
