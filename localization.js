import getUserLocale from "get-user-locale";

// Language code to language name mapping
export const LANGUAGE_NAMES = {
  'en': 'English',
  'es': 'Español',
  'fr': 'Français',
  'de': 'Deutsch',
  'it': 'Italiano',
  'pt': 'Português',
  'ru': 'Русский',
  'ja': '日本語',
  'ko': '한국어',
  'zh': '中文',
  'ar': 'العربية',
  'hi': 'हिन्दी',
  'nl': 'Nederlands',
  'pl': 'Polski',
  'tr': 'Türkçe',
  'vi': 'Tiếng Việt',
  'th': 'ไทย',
  'sv': 'Svenska',
  'da': 'Dansk',
  'fi': 'Suomi',
  'no': 'Norsk',
  'cs': 'Čeština',
  'uk': 'Українська',
};

// Translation strings for all supported languages
const TRANSLATIONS = {
  en: {
    // Usage messages
    usage_header: "Usage: youtube-chat <youtube-url>",
    usage_examples: "\nExamples:",
    usage_example_1: "  youtube-chat https://youtu.be/bZQun8Y4L2A",
    usage_note: "\nNote: Use the /lang command to change language preferences interactively",

    // Initialization messages
    loading_transcript: "🔄 Loading YouTube video transcript...",
    detected_locale: "🌐 Detected locale: {locale}",
    using_saved_language: "📄 Using saved language preference: {language}",
    transcript_fallback: "⚠️  {language} transcript not available, falling back to English",
    transcript_language: "📝 Transcript language: {language}",
    video_duration_warning: "⚠️  Could not fetch video duration: {error}",
    video_info_title: "📹 Video: {title}",
    video_info_author: "👤 Author: {author}",
    video_info_duration: "⏱️  Duration: {duration}",

    // Error messages
    error_no_transcript: "Failed to load transcript. Video may not have captions available.",
    error_no_transcript_any: "Failed to load transcript. Video may not have captions available in any language.",
    error_invalid_url: "Invalid YouTube URL format",
    error_save_config: "❌ Failed to save config: {error}",
    error_clipboard_copy: "❌ Failed to copy to clipboard: {error}",
    error_file_save: "❌ Failed to save file: {error}",
    error_generating_summary: "❌ Error generating summary: {error}",
    error_general: "❌ Error: {error}",

    // Chat interface
    chat_started_header: "💬 Chat started! Ask questions about the video.",
    chat_started_with_languages: "💬 Chat started! (UI: {uiLanguage} | Transcript: {transcriptLanguage})",
    chat_exit_instruction: "Type 'exit', 'quit', or press Ctrl+C to end the session.",
    chat_export_instruction: "Type '/export' to export the conversation.",
    chat_lang_instruction: "Type '/lang' to change language settings.",
    chat_thinking: "🤔 Thinking...",
    chat_goodbye: "👋 Goodbye!",

    // Export functionality
    export_header: "Export Conversation",
    export_select_method: "\nSelect export method:\n",
    export_option_clipboard: "1. Copy to clipboard   Copy the conversation to your system clipboard",
    export_option_file: "2. Save to file        Save the conversation to a file in the current directory\n",
    export_choice_prompt: "Enter your choice (1 or 2): ",
    export_invalid_choice: "❌ Invalid choice. Please enter 1 or 2.",
    export_clipboard_success: "✅ Conversation copied to clipboard!",
    export_file_prompt: "Enter filename (default: {filename}): ",
    export_file_success: "✅ Conversation saved to: {filename}",
    export_title: "YouTube Chat Conversation Export",
    export_no_history: "No conversation history available.",

    // Language settings
    lang_header: "Language Settings",
    lang_current: "\nCurrent language: {language}",
    lang_transcript_preference: "Transcript preference: {preference}",
    lang_prefer_accurate: "Prefer accurate English transcript",
    lang_prefer_native: "Prefer native language transcript",
    lang_available: "\nAvailable languages:\n",
    lang_auto_detect: "Auto-detect (use system locale)",
    lang_choice_prompt: "Enter your choice (1-{max}): ",
    lang_invalid_choice: "❌ Invalid choice. Please enter a number between 1 and {max}.",
    lang_set_auto: "✅ Language set to auto-detect (system locale)",
    lang_set_to: "✅ Language set to: {name} ({code})",
    lang_saved: "💾 Settings saved to ~/.youtube-chat-config.json",
    lang_effect_notice: "ℹ️  Changes will take effect when you load the next video",
    lang_transcript_toggle_prompt: "\nTranscript preference:\n  1. Prefer my language (fallback to English if unavailable)\n  2. Always use English transcript (most accurate)\n\nEnter choice (1 or 2, or press Enter to keep current): ",
    lang_transcript_set_native: "✅ Transcript preference: Prefer native language",
    lang_transcript_set_english: "✅ Transcript preference: Always use English",

    // Summary generation
    summary_generating: "🔄 Generating summary...",
    summary_question: "What are the main topics covered?",
    summary_intro: "Based on the video \"{title}\", the main topics are:",

    // Role labels
    role_you: "You",
    role_assistant: "Assistant",

    // System prompts (for AI agent)
    system_prompt_intro: "You are a helpful assistant that answers questions about a YouTube video based on its transcript.",
    system_prompt_language: "\n\nIMPORTANT: The user's locale is \"{locale}\" and they speak {languageName}.\nYou MUST respond in {languageName}.\nAlways provide your answers in {languageName} to match the user's language preference.",
    system_prompt_instructions: "\n\nWhen answering questions:\n- Search the transcript to find relevant information\n- Provide specific details and examples when possible\n- If you can't find information in the transcript, say so\n- Respond naturally and conversationally in {languageName}",
  },

  es: {
    usage_header: "Uso: youtube-chat <url-de-youtube>",
    usage_examples: "\nEjemplos:",
    usage_example_1: "  youtube-chat https://youtu.be/bZQun8Y4L2A",
    usage_note: "\nNota: Use el comando /lang para cambiar las preferencias de idioma de forma interactiva",

    loading_transcript: "🔄 Cargando transcripción del video de YouTube...",
    detected_locale: "🌐 Localización detectada: {locale}",
    using_saved_language: "📄 Usando preferencia de idioma guardada: {language}",
    transcript_fallback: "⚠️  Transcripción en {language} no disponible, usando inglés",
    transcript_language: "📝 Idioma de transcripción: {language}",
    video_duration_warning: "⚠️  No se pudo obtener la duración del video: {error}",
    video_info_title: "📹 Video: {title}",
    video_info_author: "👤 Autor: {author}",
    video_info_duration: "⏱️  Duración: {duration}",

    error_no_transcript: "No se pudo cargar la transcripción. Es posible que el video no tenga subtítulos disponibles.",
    error_no_transcript_any: "No se pudo cargar la transcripción. Es posible que el video no tenga subtítulos disponibles en ningún idioma.",
    error_invalid_url: "Formato de URL de YouTube no válido",
    error_save_config: "❌ Error al guardar configuración: {error}",
    error_clipboard_copy: "❌ Error al copiar al portapapeles: {error}",
    error_file_save: "❌ Error al guardar archivo: {error}",
    error_generating_summary: "❌ Error al generar resumen: {error}",
    error_general: "❌ Error: {error}",

    chat_started_header: "💬 ¡Chat iniciado! Haz preguntas sobre el video.",
    chat_started_with_languages: "💬 ¡Chat iniciado! (Interfaz: {uiLanguage} | Transcripción: {transcriptLanguage})",
    chat_exit_instruction: "Escribe 'exit', 'quit' o presiona Ctrl+C para finalizar la sesión.",
    chat_export_instruction: "Escribe '/export' para exportar la conversación.",
    chat_lang_instruction: "Escribe '/lang' para cambiar la configuración de idioma.",
    chat_thinking: "🤔 Pensando...",
    chat_goodbye: "👋 ¡Hasta luego!",

    export_header: "Exportar Conversación",
    export_select_method: "\nSelecciona el método de exportación:\n",
    export_option_clipboard: "1. Copiar al portapapeles   Copia la conversación al portapapeles del sistema",
    export_option_file: "2. Guardar en archivo       Guarda la conversación en un archivo en el directorio actual\n",
    export_choice_prompt: "Ingresa tu elección (1 o 2): ",
    export_invalid_choice: "❌ Elección no válida. Por favor ingresa 1 o 2.",
    export_clipboard_success: "✅ ¡Conversación copiada al portapapeles!",
    export_file_prompt: "Ingresa el nombre del archivo (predeterminado: {filename}): ",
    export_file_success: "✅ Conversación guardada en: {filename}",
    export_title: "Exportación de Conversación de YouTube Chat",
    export_no_history: "No hay historial de conversación disponible.",

    lang_header: "Configuración de Idioma",
    lang_current: "\nIdioma actual: {language}",
    lang_transcript_preference: "Preferencia de transcripción: {preference}",
    lang_prefer_accurate: "Preferir transcripción en inglés (más precisa)",
    lang_prefer_native: "Preferir transcripción en mi idioma",
    lang_available: "\nIdiomas disponibles:\n",
    lang_auto_detect: "Auto-detectar (usar localización del sistema)",
    lang_choice_prompt: "Ingresa tu elección (1-{max}): ",
    lang_invalid_choice: "❌ Elección no válida. Por favor ingresa un número entre 1 y {max}.",
    lang_set_auto: "✅ Idioma configurado en auto-detectar (localización del sistema)",
    lang_set_to: "✅ Idioma configurado en: {name} ({code})",
    lang_saved: "💾 Configuración guardada en ~/.youtube-chat-config.json",
    lang_effect_notice: "ℹ️  Los cambios tendrán efecto cuando cargues el próximo video",
    lang_transcript_toggle_prompt: "\nPreferencia de transcripción:\n  1. Preferir mi idioma (usar inglés si no está disponible)\n  2. Siempre usar transcripción en inglés (más precisa)\n\nIngresa tu elección (1 o 2, o presiona Enter para mantener la actual): ",
    lang_transcript_set_native: "✅ Preferencia de transcripción: Preferir idioma nativo",
    lang_transcript_set_english: "✅ Preferencia de transcripción: Siempre usar inglés",

    summary_generating: "🔄 Generando resumen...",
    summary_question: "¿Cuáles son los temas principales tratados?",
    summary_intro: "Basado en el video \"{title}\", los temas principales son:",

    // Role labels
    role_you: "Tú",
    role_assistant: "Asistente",

    system_prompt_intro: "Eres un asistente útil que responde preguntas sobre un video de YouTube basándose en su transcripción.",
    system_prompt_language: "\n\nIMPORTANTE: La localización del usuario es \"{locale}\" y habla {languageName}.\nDEBES responder en {languageName}.\nSiempre proporciona tus respuestas en {languageName} para coincidir con la preferencia de idioma del usuario.",
    system_prompt_instructions: "\n\nAl responder preguntas:\n- Busca en la transcripción para encontrar información relevante\n- Proporciona detalles específicos y ejemplos cuando sea posible\n- Si no puedes encontrar información en la transcripción, dilo\n- Responde de manera natural y conversacional en {languageName}",
  },

  fr: {
    usage_header: "Usage: youtube-chat <url-youtube>",
    usage_examples: "\nExemples:",
    usage_example_1: "  youtube-chat https://youtu.be/bZQun8Y4L2A",
    usage_note: "\nRemarque: Utilisez la commande /lang pour modifier les préférences linguistiques de manière interactive",

    loading_transcript: "🔄 Chargement de la transcription de la vidéo YouTube...",
    detected_locale: "🌐 Locale détectée: {locale}",
    using_saved_language: "📄 Utilisation de la préférence linguistique enregistrée: {language}",
    transcript_fallback: "⚠️  Transcription {language} non disponible, utilisation de l'anglais",
    transcript_language: "📝 Langue de transcription: {language}",
    video_duration_warning: "⚠️  Impossible d'obtenir la durée de la vidéo: {error}",
    video_info_title: "📹 Vidéo: {title}",
    video_info_author: "👤 Auteur: {author}",
    video_info_duration: "⏱️  Durée: {duration}",

    error_no_transcript: "Échec du chargement de la transcription. La vidéo peut ne pas avoir de sous-titres disponibles.",
    error_no_transcript_any: "Échec du chargement de la transcription. La vidéo peut ne pas avoir de sous-titres disponibles dans aucune langue.",
    error_invalid_url: "Format d'URL YouTube non valide",
    error_save_config: "❌ Échec de l'enregistrement de la configuration: {error}",
    error_clipboard_copy: "❌ Échec de la copie dans le presse-papiers: {error}",
    error_file_save: "❌ Échec de l'enregistrement du fichier: {error}",
    error_generating_summary: "❌ Erreur lors de la génération du résumé: {error}",
    error_general: "❌ Erreur: {error}",

    chat_started_header: "💬 Chat démarré! Posez des questions sur la vidéo.",
    chat_started_with_languages: "💬 Chat démarré! (Interface: {uiLanguage} | Transcription: {transcriptLanguage})",
    chat_exit_instruction: "Tapez 'exit', 'quit' ou appuyez sur Ctrl+C pour terminer la session.",
    chat_export_instruction: "Tapez '/export' pour exporter la conversation.",
    chat_lang_instruction: "Tapez '/lang' pour modifier les paramètres de langue.",
    chat_thinking: "🤔 Réflexion...",
    chat_goodbye: "👋 Au revoir!",

    export_header: "Exporter la Conversation",
    export_select_method: "\nSélectionnez la méthode d'exportation:\n",
    export_option_clipboard: "1. Copier dans le presse-papiers   Copie la conversation dans le presse-papiers du système",
    export_option_file: "2. Enregistrer dans un fichier     Enregistre la conversation dans un fichier du répertoire actuel\n",
    export_choice_prompt: "Entrez votre choix (1 ou 2): ",
    export_invalid_choice: "❌ Choix non valide. Veuillez entrer 1 ou 2.",
    export_clipboard_success: "✅ Conversation copiée dans le presse-papiers!",
    export_file_prompt: "Entrez le nom du fichier (par défaut: {filename}): ",
    export_file_success: "✅ Conversation enregistrée dans: {filename}",
    export_title: "Exportation de Conversation YouTube Chat",
    export_no_history: "Aucun historique de conversation disponible.",

    lang_header: "Paramètres de Langue",
    lang_current: "\nLangue actuelle: {language}",
    lang_transcript_preference: "Préférence de transcription: {preference}",
    lang_prefer_accurate: "Préférer une transcription anglaise précise",
    lang_prefer_native: "Préférer la transcription en langue native",
    lang_available: "\nLangues disponibles:\n",
    lang_auto_detect: "Détection automatique (utiliser la locale du système)",
    lang_choice_prompt: "Entrez votre choix (1-{max}): ",
    lang_invalid_choice: "❌ Choix non valide. Veuillez entrer un nombre entre 1 et {max}.",
    lang_set_auto: "✅ Langue définie sur détection automatique (locale du système)",
    lang_set_to: "✅ Langue définie sur: {name} ({code})",
    lang_saved: "💾 Paramètres enregistrés dans ~/.youtube-chat-config.json",
    lang_effect_notice: "ℹ️  Les modifications prendront effet lors du chargement de la prochaine vidéo",
    lang_transcript_toggle_prompt: "\nPréférence de transcription:\n  1. Préférer ma langue (revenir à l'anglais si non disponible)\n  2. Toujours utiliser la transcription anglaise (plus précise)\n\nEntrez votre choix (1 ou 2, ou appuyez sur Entrée pour conserver l'actuel): ",
    lang_transcript_set_native: "✅ Préférence de transcription: Préférer la langue native",
    lang_transcript_set_english: "✅ Préférence de transcription: Toujours utiliser l'anglais",

    summary_generating: "🔄 Génération du résumé...",
    summary_question: "Quels sont les principaux sujets abordés?",
    summary_intro: "D'après la vidéo \"{title}\", les principaux sujets sont:",

    // Role labels
    role_you: "Vous",
    role_assistant: "Assistant",

    system_prompt_intro: "Vous êtes un assistant utile qui répond aux questions sur une vidéo YouTube en fonction de sa transcription.",
    system_prompt_language: "\n\nIMPORTANT: La locale de l'utilisateur est \"{locale}\" et il parle {languageName}.\nVous DEVEZ répondre en {languageName}.\nFournissez toujours vos réponses en {languageName} pour correspondre à la préférence linguistique de l'utilisateur.",
    system_prompt_instructions: "\n\nLors de la réponse aux questions:\n- Recherchez dans la transcription pour trouver des informations pertinentes\n- Fournissez des détails spécifiques et des exemples lorsque cela est possible\n- Si vous ne trouvez pas d'informations dans la transcription, dites-le\n- Répondez naturellement et de manière conversationnelle en {languageName}",
  },

  de: {
    usage_header: "Verwendung: youtube-chat <youtube-url>",
    usage_examples: "\nBeispiele:",
    usage_example_1: "  youtube-chat https://youtu.be/bZQun8Y4L2A",
    usage_note: "\nHinweis: Verwenden Sie den Befehl /lang, um Spracheinstellungen interaktiv zu ändern",

    loading_transcript: "🔄 YouTube-Video-Transkript wird geladen...",
    detected_locale: "🌐 Erkanntes Gebietsschema: {locale}",
    using_saved_language: "📄 Gespeicherte Spracheinstellung wird verwendet: {language}",
    transcript_fallback: "⚠️  {language}-Transkript nicht verfügbar, verwende Englisch",
    transcript_language: "📝 Transkript-Sprache: {language}",
    video_duration_warning: "⚠️  Videodauer konnte nicht abgerufen werden: {error}",
    video_info_title: "📹 Video: {title}",
    video_info_author: "👤 Autor: {author}",
    video_info_duration: "⏱️  Dauer: {duration}",

    error_no_transcript: "Transkript konnte nicht geladen werden. Das Video hat möglicherweise keine verfügbaren Untertitel.",
    error_no_transcript_any: "Transkript konnte nicht geladen werden. Das Video hat möglicherweise keine Untertitel in irgendeiner Sprache.",
    error_invalid_url: "Ungültiges YouTube-URL-Format",
    error_save_config: "❌ Konfiguration konnte nicht gespeichert werden: {error}",
    error_clipboard_copy: "❌ Kopieren in die Zwischenablage fehlgeschlagen: {error}",
    error_file_save: "❌ Datei konnte nicht gespeichert werden: {error}",
    error_generating_summary: "❌ Fehler beim Generieren der Zusammenfassung: {error}",
    error_general: "❌ Fehler: {error}",

    chat_started_header: "💬 Chat gestartet! Stellen Sie Fragen zum Video.",
    chat_started_with_languages: "💬 Chat gestartet! (Benutzeroberfläche: {uiLanguage} | Transkript: {transcriptLanguage})",
    chat_exit_instruction: "Geben Sie 'exit', 'quit' ein oder drücken Sie Strg+C, um die Sitzung zu beenden.",
    chat_export_instruction: "Geben Sie '/export' ein, um die Konversation zu exportieren.",
    chat_lang_instruction: "Geben Sie '/lang' ein, um die Spracheinstellungen zu ändern.",
    chat_thinking: "🤔 Denke nach...",
    chat_goodbye: "👋 Auf Wiedersehen!",

    export_header: "Konversation Exportieren",
    export_select_method: "\nWählen Sie die Exportmethode:\n",
    export_option_clipboard: "1. In Zwischenablage kopieren   Kopiert die Konversation in die System-Zwischenablage",
    export_option_file: "2. In Datei speichern           Speichert die Konversation in einer Datei im aktuellen Verzeichnis\n",
    export_choice_prompt: "Geben Sie Ihre Wahl ein (1 oder 2): ",
    export_invalid_choice: "❌ Ungültige Wahl. Bitte geben Sie 1 oder 2 ein.",
    export_clipboard_success: "✅ Konversation in Zwischenablage kopiert!",
    export_file_prompt: "Geben Sie den Dateinamen ein (Standard: {filename}): ",
    export_file_success: "✅ Konversation gespeichert in: {filename}",
    export_title: "YouTube Chat Konversation Export",
    export_no_history: "Kein Konversationsverlauf verfügbar.",

    lang_header: "Spracheinstellungen",
    lang_current: "\nAktuelle Sprache: {language}",
    lang_transcript_preference: "Transkript-Präferenz: {preference}",
    lang_prefer_accurate: "Präzises englisches Transkript bevorzugen",
    lang_prefer_native: "Muttersprachliches Transkript bevorzugen",
    lang_available: "\nVerfügbare Sprachen:\n",
    lang_auto_detect: "Automatisch erkennen (System-Gebietsschema verwenden)",
    lang_choice_prompt: "Geben Sie Ihre Wahl ein (1-{max}): ",
    lang_invalid_choice: "❌ Ungültige Wahl. Bitte geben Sie eine Zahl zwischen 1 und {max} ein.",
    lang_set_auto: "✅ Sprache auf automatische Erkennung eingestellt (System-Gebietsschema)",
    lang_set_to: "✅ Sprache eingestellt auf: {name} ({code})",
    lang_saved: "💾 Einstellungen gespeichert in ~/.youtube-chat-config.json",
    lang_effect_notice: "ℹ️  Änderungen werden beim Laden des nächsten Videos wirksam",
    lang_transcript_toggle_prompt: "\nTranskript-Präferenz:\n  1. Meine Sprache bevorzugen (auf Englisch zurückgreifen, falls nicht verfügbar)\n  2. Immer englisches Transkript verwenden (am genauesten)\n\nGeben Sie Ihre Wahl ein (1 oder 2, oder drücken Sie die Eingabetaste, um die aktuelle beizubehalten): ",
    lang_transcript_set_native: "✅ Transkript-Präferenz: Muttersprache bevorzugen",
    lang_transcript_set_english: "✅ Transkript-Präferenz: Immer Englisch verwenden",

    summary_generating: "🔄 Zusammenfassung wird generiert...",
    summary_question: "Welche Hauptthemen werden behandelt?",
    summary_intro: "Basierend auf dem Video \"{title}\" sind die Hauptthemen:",

    // Role labels
    role_you: "Sie",
    role_assistant: "Assistent",

    system_prompt_intro: "Sie sind ein hilfreicher Assistent, der Fragen zu einem YouTube-Video auf Grundlage seiner Transkription beantwortet.",
    system_prompt_language: "\n\nWICHTIG: Das Gebietsschema des Benutzers ist \"{locale}\" und er spricht {languageName}.\nSie MÜSSEN auf {languageName} antworten.\nGeben Sie Ihre Antworten immer auf {languageName}, um der Sprachpräferenz des Benutzers zu entsprechen.",
    system_prompt_instructions: "\n\nBeim Beantworten von Fragen:\n- Durchsuchen Sie die Transkription, um relevante Informationen zu finden\n- Geben Sie spezifische Details und Beispiele an, wenn möglich\n- Wenn Sie keine Informationen in der Transkription finden, sagen Sie es\n- Antworten Sie natürlich und gesprächig auf {languageName}",
  },
};

/**
 * Get a translated message by key with optional parameter substitution
 * @param {string} key - The message key
 * @param {string} locale - The locale code (e.g., 'en-US', 'es', 'fr-FR')
 * @param {Object} params - Parameters to substitute in the message
 * @returns {string} The translated message
 */
export function getMessage(key, locale, params = {}) {
  // Extract language code from locale (e.g., 'en-US' -> 'en')
  const language = locale ? locale.split('-')[0] : 'en';

  // Get translation for the language, fallback to English
  const translations = TRANSLATIONS[language] || TRANSLATIONS['en'];
  let message = translations[key] || TRANSLATIONS['en'][key] || key;

  // Substitute parameters in the message
  Object.keys(params).forEach(param => {
    message = message.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
  });

  return message;
}

/**
 * Get the display name for a language code
 * @param {string} languageCode - The language code (e.g., 'en', 'es')
 * @returns {string} The language name
 */
export function getLanguageName(languageCode) {
  return LANGUAGE_NAMES[languageCode] || languageCode.toUpperCase();
}

/**
 * Detect user's locale from system settings or config
 * @param {Object} config - Configuration object that may contain language/locale override
 * @returns {Object} Object containing { language, locale }
 */
export function detectLocale(config = {}) {
  let locale, language;

  if (config.language) {
    // Use config file language
    language = config.language;
    locale = config.locale || config.language;
  } else {
    // Detect from system
    locale = getUserLocale();
    language = locale ? locale.split("-")[0] : "en";
  }

  return { language, locale };
}

/**
 * Get all available language entries as array for display
 * @returns {Array} Array of [code, name] tuples
 */
export function getLanguageEntries() {
  return Object.entries(LANGUAGE_NAMES);
}

/**
 * Check if a language code is supported
 * @param {string} languageCode - The language code to check
 * @returns {boolean} True if supported
 */
export function isLanguageSupported(languageCode) {
  return languageCode in LANGUAGE_NAMES;
}