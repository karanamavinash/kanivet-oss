export const PORT_FORWARD_PAGE_TITLE = 'Port forwarding';
export const PORT_FORWARD_DETAIL_KIND = 'PortForward';
export const PORT_FORWARD_DETAIL_API_VERSION = 'kanivet.io/portforward/v1';
export const PORT_FORWARD_RESOURCE_LIST_NAME = 'port-forwards';
export const PORT_FORWARD_LOCAL_HOST = 'localhost';
export const PORT_FORWARD_PROTOCOL_HTTP = 'http';
export const PORT_FORWARD_KIND_POD = 'pod';
export const PORT_FORWARD_KIND_SERVICE = 'service';
export const PORT_FORWARD_RESOURCE_POD = 'Pod';
export const PORT_FORWARD_RESOURCE_SERVICE = 'Service';
export const PORT_FORWARD_API_VERSION = 'v1';
export const PORT_FORWARD_STATUS_ACTIVE = 'Active';
export const PORT_FORWARD_STATUS_INACTIVE = 'Inactive';
export const PORT_FORWARD_LIST_POLL_MS = 5000;

export const PORT_FORWARD_EMPTY_HINT =
  'Open a Pod or Service, then use Forward on a port.';

export const localForwardHttpUrl = (localPort: number): string =>
  `http://${PORT_FORWARD_LOCAL_HOST}:${localPort}`;