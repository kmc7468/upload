<script lang="ts">
  import { onMount } from "svelte";
  import { isIPv4InSubnet, queryIPv4 } from "$lib/network";

  let isKAIST = false;

  onMount(async () => {
    const ipv4 = await queryIPv4();
    isKAIST = !!ipv4 && (                         // KAIST 네트워크는 IPv6를 지원하지 않음
      isIPv4InSubnet(ipv4, "143.248.0.0/16") ||   // 본원 네트워크
      isIPv4InSubnet(ipv4, "110.76.64.0/18") ||   // 기숙사 네트워크
      isIPv4InSubnet(ipv4, "192.249.16.0/20"));   // 무선 네트워크
  });
</script>

<p hidden={!isKAIST}>
  Are you in KAIST campus now?
  You can use <a href="https://kaist.upload.minchan.me"><b>https://kaist.upload.minchan.me</b></a> for faster upload.
</p>