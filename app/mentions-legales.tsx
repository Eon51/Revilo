import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

export default function LegalNoticesScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Link href="/" asChild>
        <Pressable><Text style={styles.backLink}>Retour à Révilo</Text></Pressable>
      </Link>
      <Text style={styles.title}>Mentions légales</Text>
      <Text style={styles.notice}>
        Informations incomplètes : ces mentions doivent être complétées et vérifiées avant toute publication.
      </Text>
      <Text style={styles.heading}>Éditeur</Text>
      <Text style={styles.body}>Nom ou raison sociale : à compléter par l’éditeur.</Text>
      <Text style={styles.body}>Adresse postale : à compléter.</Text>
      <Text style={styles.body}>E-mail de contact : à compléter.</Text>
      <Text style={styles.body}>Directeur de publication : à compléter.</Text>
      <Text style={styles.heading}>Hébergement</Text>
      <Text style={styles.body}>
        Hébergeur de l’application web : à confirmer avant production. Les services de compte et de données
        sont fournis par Supabase; leur localisation doit être vérifiée dans la configuration du projet.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, paddingTop: 48, paddingBottom: 48, backgroundColor: '#F7F8FC' },
  backLink: { color: '#6657F4', fontWeight: '700', marginBottom: 24 },
  title: { color: '#20243A', fontSize: 26, fontWeight: '800', marginBottom: 16 },
  notice: { color: '#8B5C18', backgroundColor: '#FFF4E8', borderRadius: 12, padding: 14, lineHeight: 20, marginBottom: 20 },
  heading: { color: '#25283A', fontSize: 17, fontWeight: '800', marginTop: 18, marginBottom: 8 },
  body: { color: '#55596A', fontSize: 14, lineHeight: 22, marginBottom: 10 },
});
