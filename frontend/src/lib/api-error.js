/**
 * Normalizes any error (FastAPI validation arrays, Pydantic objects, Axios errors, network errors)
 * into a clean, human-readable string safe for React rendering and toasts.
 */
export function formatApiError(err, fallback = "An unexpected error occurred. Please try again.") {
  if (!err) return fallback;

  if (typeof err === "string") return err;

  // FastAPI detail response
  const detail = err.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  // FastAPI / Pydantic validation error list
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!item || typeof item !== "object") return String(item);
        const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "";
        const cleanField = field && field !== "body" ? `${field.charAt(0).toUpperCase() + field.slice(1)}: ` : "";
        const cleanMsg = item.msg || "Invalid input";
        return `${cleanField}${cleanMsg}`;
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(". ");
    }
  }

  // Object detail
  if (detail && typeof detail === "object") {
    if (detail.message) return String(detail.message);
    if (detail.msg) return String(detail.msg);
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }

  if (err.response?.data?.message) {
    return String(err.response.data.message);
  }

  // HTTP status-based messages
  if (err.response?.status) {
    const status = err.response.status;
    if (status === 401) return "Session expired or authentication required. Please log in.";
    if (status === 403) return "You do not have permission to perform this action.";
    if (status === 404) return "Requested resource was not found.";
    if (status === 409) return "An account or record with these details already exists.";
    if (status === 422) return "Invalid request data. Please check your inputs.";
    if (status === 429) return "Too many requests. Please slow down and try again.";
    if (status >= 500) return "Server encountered an error. Local edge protection remains active.";
  }

  if (err.message) {
    if (err.message.includes("Network Error") || err.code === "ERR_NETWORK") {
      return "Network connection unavailable — local protection remains active.";
    }
    return String(err.message);
  }

  return fallback;
}

