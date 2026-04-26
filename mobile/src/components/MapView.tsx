import { Platform } from 'react-native';
import MapViewNative, { UrlTile as UrlTileNative, Marker as MarkerNative, Polyline as PolylineNative } from './MapView.native';
import MapViewWeb, { UrlTile as UrlTileWeb, Marker as MarkerWeb, Polyline as PolylineWeb } from './MapView.web';

const MapView = Platform.OS === 'web' ? MapViewWeb : MapViewNative;
export const UrlTile = Platform.OS === 'web' ? UrlTileWeb : UrlTileNative;
export const Marker = Platform.OS === 'web' ? MarkerWeb : MarkerNative;
export const Polyline = Platform.OS === 'web' ? PolylineWeb : PolylineNative;

export default MapView;
