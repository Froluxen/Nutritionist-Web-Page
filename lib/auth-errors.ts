export function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid email or password"))
    return "Correo o contraseña incorrectos.";
  if (m.includes("user already registered") || m.includes("already registered"))
    return "Ese correo ya tiene cuenta. Inicia sesión.";
  if (m.includes("email not confirmed") || m.includes("not confirmed"))
    return "Confirma tu correo antes de iniciar sesión.";
  if (m.includes("password") && m.includes("6"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("jwt") || m.includes("expired") || m.includes("session"))
    return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  return "Ocurrió un error. Inténtalo de nuevo.";
}

export function mapDbError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("plan pagado"))
    return "Debes tener un plan pagado para agendar una cita.";
  if (m.includes("horario ya está reservado") || m.includes("horario ya esta reservado"))
    return "Ese horario ya está reservado. Elige otro.";
  if (m.includes("fecha de la cita debe ser futura"))
    return "Elige una fecha y hora futuras.";
  if (m.includes("tipo de cita no disponible"))
    return "Ese tipo de cita no está disponible.";
  if (m.includes("estado de cita no permitido") || m.includes("no cancelable"))
    return "No puedes cambiar la cita de esa forma.";
  if (m.includes("orden inexistente o ya procesada"))
    return "La orden ya fue procesada.";
  if (m.includes("no autorizado") || m.includes("no tienes permiso"))
    return "No tienes permiso para esa acción.";
  if (m.includes("producto no disponible") || m.includes("plan no disponible"))
    return "Ese producto ya no está disponible.";
  if (
    m.includes("maximum allowed size") ||
    m.includes("exceeds the maximum") ||
    m.includes("payload too large")
  )
    return "El archivo es demasiado grande (máximo 5 MB).";
  if (m.includes("mime type") || m.includes("invalid file type"))
    return "Formato no permitido. Usa JPG, PNG, WEBP o PDF.";
  if (m.includes("bucket") && m.includes("not found"))
    return "El almacenamiento no está configurado. Avísanos para revisarlo.";
  if (m.includes("duplicate") || m.includes("unique") || m.includes("already exists"))
    return "Ese registro ya existe.";
  if (m.includes("foreign key") || m.includes("violates foreign key"))
    return "No se puede eliminar: tiene compras o citas asociadas.";
  if (m.includes("row-level security") || m.includes("violates row-level"))
    return "No tienes permiso para esa acción.";
  if (m.includes("order_detail") || m.includes("order detail"))
    return "Debes comprar el plan antes de agendar.";
  return "Ocurrió un error al guardar. Inténtalo de nuevo.";
}
