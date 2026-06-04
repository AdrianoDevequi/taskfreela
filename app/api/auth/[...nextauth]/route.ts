import { handlers } from "@/auth";

// Endpoints do NextAuth (session, csrf, providers, signin/out, callback).
// As rotas mais específicas em /api/auth/google continuam tendo prioridade.
export const { GET, POST } = handlers;
