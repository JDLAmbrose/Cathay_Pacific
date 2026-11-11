import type { AudienceFilter, Persona } from "../types";

export const STUDENT_PERSONAS: readonly Persona[] = ["student"];

export const PARENT_PERSONAS: readonly Persona[] = ["parent"];

const PERSONA_SET = new Set<string>(["student", "parent", "business"]);

export function isPersona(value: string): value is Persona {
  return PERSONA_SET.has(value);
}

export function isStudentPersona(persona: Persona): boolean {
  return persona === "student";
}

export function isParentPersona(persona: Persona): boolean {
  return persona === "parent";
}

export function isBusinessPersona(persona: Persona): boolean {
  return persona === "business";
}

export function matchesAudience(persona: Persona, filter: AudienceFilter): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "students") {
    return isStudentPersona(persona);
  }
  if (filter === "parents") {
    return isParentPersona(persona);
  }
  return isBusinessPersona(persona);
}
