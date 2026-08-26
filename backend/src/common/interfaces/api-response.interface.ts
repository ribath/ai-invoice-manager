export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: ApiErrorDetail | null;
}
