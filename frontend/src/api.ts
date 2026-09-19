export type Project = { id: number; kind: 'project' | 'jd'; title: string; description: string };
export type Candidate = { id: number; project_id: number; name: string; role: string; notes: string; resume_count?:number; session_count?:number; latest_session_id?:number; latest_session_status?:string };
export type Resume = { id: number; original_name: string; warning: string; text?: string };
export type Settings = { provider: string; base_url: string; model: string; has_api_key: boolean };
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api${path}`, init); }
  catch { throw new Error('无法连接服务，请确认前后端均已启动。'); }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : `请求失败（${response.status}），请检查输入或后端服务。`);
  }
  return response.json();
}
export function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
