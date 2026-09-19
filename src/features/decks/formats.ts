import { z } from "zod";
import { deckFormats } from "./validation";

export const deckFormatSchema = z.enum(deckFormats);
export const formatInfo = {
  commander: { label: "Commander", description: "Encuentra listas alrededor de tu comandante y descubre nuevas construcciones.", size: "100 cartas, comandante incluido" },
  standard: { label: "Standard", description: "Descubre las construcciones de la comunidad en el formato rotativo.", size: "Mínimo 60 cartas principales" },
  modern: { label: "Modern", description: "Explora estrategias, variantes y listas de Modern.", size: "Mínimo 60 cartas principales" },
  pioneer: { label: "Pioneer", description: "Comparte tus ideas y encuentra otras versiones de tu estrategia en Pioneer.", size: "Mínimo 60 cartas principales" },
};

export const pageNumberSchema = z.coerce.number().int().min(1).max(10000).catch(1);

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
