import { XHR } from './platform/xhr';


export function request(url: string | URL, init?: Omit<XHR.RequestInit, 'url'>): Promise<XHR.Response>;
export function request(init: Omit<XHR.RequestInit, 'url'> & { url: string | URL }): Promise<XHR.Response>;
export async function request(
  urlOrInit: string | URL | Omit<XHR.RequestInit, 'url'> & { url: string | URL },
  init?: Omit<XHR.RequestInit, 'url'> // eslint-disable-line comma-dangle
): Promise<XHR.Response> {
  if(typeof process !== 'undefined') {
    const nodeRequest = (await import('./platform/node/request')).request;
    return await nodeRequest(urlOrInit as string, init);
  }

  const browserRequest = (await import('./platform/browser/request')).request;
  return await browserRequest(urlOrInit as string, init);
}
