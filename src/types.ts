export interface Transcription {
  id: string;
  timestamp: string;
  durationSec: number;
  filename: string;
  text: string;
  source: "recording" | "upload";
  fileSize?: string;
}

export interface TrackingLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  altitudeMeters: number;
  address?: string;
  timestamp: string;
}

export interface Telemetry {
  batteryLevel: number;
  batteryState: string;
  carrier: string;
  networkStrengthDbm: number;
  connectionType: string;
  imei: string;
  simSerial: string;
  tempCelsius: number;
  operatingSystem: string;
  deviceModel: string;
}

export interface LocationHistoryItem {
  timestamp: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface TrackingInfo {
  status: string;
  ownerName: string;
  phoneNumber: string;
  location: TrackingLocation;
  telemetry: Telemetry;
  history: LocationHistoryItem[];
}

