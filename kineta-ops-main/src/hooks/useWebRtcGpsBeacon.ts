import { useCallback, useEffect, useRef, useState } from "react";

export type GpsBeaconPayload = {
  type: "gps";
  lat: number;
  lng: number;
  accuracy?: number;
  t: number;
};

const ICE = [{ urls: "stun:stun.l.google.com:19302" }] as RTCIceServer[];

/**
 * Local WebRTC data-channel loopback: sender PC streams GPS fixes over the channel;
 * receiver PC surfaces the same path ops would see from a field beacon device.
 */
export function useWebRtcGpsBeacon(opts: { enabled: boolean; highAccuracy?: boolean }) {
  const { enabled, highAccuracy = true } = opts;
  const [peerState, setPeerState] = useState<RTCPeerConnectionState>("new");
  const [iceState, setIceState] = useState<RTCIceConnectionState>("new");
  const [uplinkState, setUplinkState] = useState<RTCDataChannelState>("connecting");
  const [lastSent, setLastSent] = useState<GpsBeaconPayload | null>(null);
  const [lastReceived, setLastReceived] = useState<GpsBeaconPayload | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const pc1 = useRef<RTCPeerConnection | null>(null);
  const pc2 = useRef<RTCPeerConnection | null>(null);
  const dcSender = useRef<RTCDataChannel | null>(null);
  const watchRef = useRef<number>(0);

  const teardown = useCallback(() => {
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = 0;
    }
    dcSender.current?.close();
    dcSender.current = null;
    pc1.current?.close();
    pc2.current?.close();
    pc1.current = null;
    pc2.current = null;
    setPeerState("closed");
    setIceState("closed");
    setUplinkState("closed");
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !navigator.geolocation) {
      if (!enabled) teardown();
      if (enabled && typeof navigator !== "undefined" && !navigator.geolocation) {
        setGpsError("Geolocation not supported");
      }
      return;
    }

    let cancelled = false;
    setGpsError(null);
    setLastSent(null);
    setLastReceived(null);

    const run = async () => {
      const sender = new RTCPeerConnection({ iceServers: ICE });
      const receiver = new RTCPeerConnection({ iceServers: ICE });
      pc1.current = sender;
      pc2.current = receiver;

      const onSenderState = () => setPeerState(sender.connectionState);
      const onIce = () => setIceState(sender.iceConnectionState);
      sender.addEventListener("connectionstatechange", onSenderState);
      sender.addEventListener("iceconnectionstatechange", onIce);
      setPeerState(sender.connectionState);
      setIceState(sender.iceConnectionState);

      const dc = sender.createDataChannel("emergency-beacon", { ordered: true });
      dcSender.current = dc;
      dc.onopen = () => setUplinkState(dc.readyState);
      dc.onclose = () => setUplinkState("closed");

      receiver.ondatachannel = ({ channel }) => {
        channel.onmessage = (ev) => {
          try {
            const p = JSON.parse(String(ev.data)) as GpsBeaconPayload;
            if (p.type === "gps" && typeof p.lat === "number" && typeof p.lng === "number") {
              setLastReceived(p);
            }
          } catch {
            /* ignore */
          }
        };
      };

      const flushIce = (from: RTCPeerConnection, to: RTCPeerConnection) => {
        from.onicecandidate = (e) => {
          if (e.candidate && !cancelled) void to.addIceCandidate(e.candidate);
        };
      };
      flushIce(sender, receiver);
      flushIce(receiver, sender);

      const offer = await sender.createOffer();
      await sender.setLocalDescription(offer);
      await receiver.setRemoteDescription(sender.localDescription!);
      const answer = await receiver.createAnswer();
      await receiver.setLocalDescription(answer);
      await sender.setRemoteDescription(receiver.localDescription!);

      if (cancelled) {
        teardown();
        return;
      }

      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const payload: GpsBeaconPayload = {
            type: "gps",
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            t: Date.now(),
          };
          setLastSent(payload);
          if (dc.readyState === "open") {
            try {
              dc.send(JSON.stringify(payload));
            } catch {
              /* channel may drop */
            }
          }
        },
        (err) => setGpsError(err.message || "GPS unavailable"),
        { enableHighAccuracy: highAccuracy, maximumAge: 2000, timeout: 15000 },
      );
    };

    void run().catch(() => {
      setGpsError("WebRTC setup failed");
      teardown();
    });

    return () => {
      cancelled = true;
      teardown();
    };
  }, [enabled, highAccuracy, teardown]);

  return {
    peerState,
    iceState,
    uplinkState,
    lastSent,
    lastReceived,
    gpsError,
  };
}
