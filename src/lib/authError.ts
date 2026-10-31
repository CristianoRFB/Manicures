/** Public UI must not leak Firebase internals or account existence through errors.
 * Server-side quotas and abuse prevention remain Firebase configuration concerns.
 */
export type AuthOperation = "login" | "register" | "reset" | "verify";
export function publicAuthError(error: unknown, operation: AuthOperation): string {
  const code = error && typeof error === "object" && "code" in error
    ? (error as {code?: unknown}).code : undefined;
  if (code === "auth/network-request-failed" || code === "auth/timeout")
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  if (code === "auth/too-many-requests")
    return "Muitas tentativas em pouco tempo. Aguarde antes de tentar novamente.";
  if (code === "auth/invalid-email")
    return "Informe um endereço de e-mail válido.";
  if (code === "auth/weak-password" && operation === "register")
    return "Escolha uma senha com pelo menos 6 caracteres.";
  if (operation === "login")
    return "Não foi possível entrar. Verifique e-mail e senha e tente novamente.";
  if (operation === "register")
    return "Não foi possível criar a conta. Revise os dados ou tente entrar com uma conta existente.";
  if (operation === "reset")
    return "Não foi possível solicitar a recuperação agora. Tente novamente mais tarde.";
  return "Não foi possível confirmar seu e-mail agora. Tente novamente.";
}
