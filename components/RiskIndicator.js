import { Text, View, StyleSheet, Image } from 'react-native';

export default function RiskIndicator({risk}) {
  return (
    <View style={styles.container}>
      <Text style={styles['risk'+risk]}>
        Predicted Severity: {risk}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  risk1: {
    margin: 24,
    marginTop: 0,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'green'
  },
  risk2: {
    margin: 24,
    marginTop: 0,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'yellow'
  },
  risk3: {
    margin: 24,
    marginTop: 0,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'orange'
  },
  risk4: {
    margin: 24,
    marginTop: 0,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'red'
  },
  riskNA: {
    margin: 24,
    marginTop: 0,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'grey'
  },
});
