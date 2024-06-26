const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;

const convertIPv4ToNumber = (ipv4: string) => {
  const parts = ipv4.split(".");
  return parts.reduce((acc, part) => {
    return acc * 256 + parseInt(part, 10);
  }, 0);
}

export const isIPv4InSubnet = (ipv4: string, subnet: string) => {
  const [subnetIPv4, subnetPrefix] = subnet.split("/");
  const subnetIPv4Number = convertIPv4ToNumber(subnetIPv4);
  const subnetMask = 0xFFFFFFFF << (32 - parseInt(subnetPrefix, 10));

  const ipv4Number = convertIPv4ToNumber(ipv4);
  return (ipv4Number & subnetMask) === (subnetIPv4Number & subnetMask);
}

export const queryIPv4 = async () => {
  const response = await fetch("https://cloudflare.com/cdn-cgi/trace");
  if (!response.ok) {
    return null;
  }

  const text = await response.text();
  const ipv4 = text.match(/ip=(\S+)/)?.[1];
  if (!ipv4 || !ipv4Regex.test(ipv4)) {
    return null;
  }

  return ipv4;
};