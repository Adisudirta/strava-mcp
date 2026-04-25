export type Env = { Bindings: CloudflareBindings & { ENCRYPTION_KEY: string } };

export type StravaAthlete = {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
};

export type StravaTokenRecord = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
  athlete: StravaAthlete;
};

export type StravaTokenResponse = {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete?: StravaAthlete;
};

export type StravaTokenError = {
  message: string;
  errors?: Array<{ resource: string; field: string; code: string }>;
};
