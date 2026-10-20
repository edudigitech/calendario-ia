/**
 * Supabase Auth devuelve los errores en inglés y con textos pensados para
 * desarrolladores. Aquí se traducen a algo que un usuario pueda entender.
 */
const RULES: Array<[RegExp, string]> = [
  [
    /invalid login credentials/i,
    'Email o contraseña incorrectos.',
  ],
  [
    /email not confirmed/i,
    'Tu cuenta aún no está confirmada. Revisa el correo que te enviamos y pulsa el enlace.',
  ],
  [
    /user already registered|already been registered/i,
    'Ya existe una cuenta con ese email. Prueba a entrar.',
  ],
  [
    /password should be at least (\d+)/i,
    'La contraseña es demasiado corta.',
  ],
  [
    /signup requires a valid password/i,
    'La contraseña no es válida.',
  ],
  [
    /email address .* is invalid|unable to validate email|invalid format|invalid email/i,
    'Ese email no parece válido. Usa una dirección real.',
  ],
  [
    /email rate limit|rate limit|too many requests/i,
    'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.',
  ],
  [
    /signups not allowed/i,
    'El registro está cerrado ahora mismo.',
  ],
  [
    /failed to fetch|networkerror|network request failed/i,
    'No he podido conectar con el servidor. Revisa tu conexión.',
  ],
  [
    /jwt expired|invalid jwt|invalid claim/i,
    'Tu sesión ha caducado. Vuelve a entrar.',
  ],
  [
    /user not found/i,
    'No existe ninguna cuenta con ese email.',
  ],
]

export function authErrorMessage(message: string): string {
  for (const [pattern, text] of RULES) {
    if (pattern.test(message)) return text
  }
  return message
}
