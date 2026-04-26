import React from 'react';
import { View, Text } from 'react-native';

export const MapView = ({ children, style }: any) => (
  <View style={[style, { backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' }]}>
    <Text style={{ color: '#666' }}>Map is not supported on Web.</Text>
    {children}
  </View>
);

export const UrlTile = () => null;
export const Marker = () => null;
export const Polyline = () => null;

export default MapView;
