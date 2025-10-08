import toast from 'react-hot-toast';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export function notifyError(error: any, fallback: string = 'An error occurred') {
  // Handle different error formats
  let errorCode: string | null = null;
  let errorMessage: string = fallback;

  if (error?.response?.data?.error?.code) {
    // Axios error response format: { response: { data: { error: { code, message } } } }
    errorCode = error.response.data.error.code;
    errorMessage = error.response.data.error.message || fallback;
  } else if (error?.error?.code) {
    // Server error response format: { error: { code, message, details } }
    errorCode = error.error.code;
    errorMessage = error.error.message || fallback;
  } else if (error?.code) {
    // Direct error object with code
    errorCode = error.code;
    errorMessage = error.message || fallback;
  } else if (error?.message) {
    // Simple error with message
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    // String error
    errorMessage = error;
  }

  // Show specific error messages based on error codes
  if (errorCode === 'PDF_EMPTY') {
    toast.error(
      <div className="space-y-2">
        <div className="font-semibold">PDF senza testo</div>
        <div className="text-sm">
          Il PDF non contiene testo estraibile (o è protetto). Carica un PDF testuale o usa l'opzione URL/HTML.
        </div>
        <div className="text-xs">
          <a 
            href="/PDF_TROUBLESHOOTING.md" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Apri guida
          </a>
        </div>
      </div>,
      { duration: 8000 }
    );
    return;
  }

  if (errorCode === 'FILE_TOO_LARGE') {
    toast.error(
      <div className="space-y-1">
        <div className="font-semibold">File troppo grande</div>
        <div className="text-sm">{errorMessage}</div>
      </div>,
      { duration: 5000 }
    );
    return;
  }

  if (errorCode === 'INVALID_FILE_TYPE' || errorCode === 'INVALID_PDF_SIGNATURE') {
    toast.error(
      <div className="space-y-1">
        <div className="font-semibold">Tipo di file non valido</div>
        <div className="text-sm">{errorMessage}</div>
      </div>,
      { duration: 5000 }
    );
    return;
  }

  if (errorCode === 'OPENAI_RATE_LIMIT') {
    toast.error(
      <div className="space-y-1">
        <div className="font-semibold">Limite di richieste superato</div>
        <div className="text-sm">Riprova tra qualche minuto</div>
      </div>,
      { duration: 5000 }
    );
    return;
  }

  if (errorCode === 'NAVIGATION_TIMEOUT') {
    toast.error(
      <div className="space-y-1">
        <div className="font-semibold">Timeout di navigazione</div>
        <div className="text-sm">Il sito ha impiegato troppo tempo a rispondere</div>
      </div>,
      { duration: 5000 }
    );
    return;
  }

  if (errorCode === 'URL_INVALID') {
    toast.error(
      <div className="space-y-1">
        <div className="font-semibold">URL non valido</div>
        <div className="text-sm">{errorMessage}</div>
      </div>,
      { duration: 5000 }
    );
    return;
  }

  // Generic error fallback
  toast.error(
    <div className="space-y-1">
      <div className="font-semibold">Errore</div>
      <div className="text-sm">{errorMessage}</div>
      {errorCode && (
        <div className="text-xs text-gray-500">Codice: {errorCode}</div>
      )}
    </div>,
    { duration: 5000 }
  );
}
