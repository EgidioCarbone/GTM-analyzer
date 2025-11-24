// Global window extensions used across the project
interface Window {
  dataLayer?: any[];
  google_tag_manager?: Record<string, any>;
}

declare namespace NodeJS {
  interface Global {
    dataLayer?: any[];
    google_tag_manager?: Record<string, any>;
  }
}
