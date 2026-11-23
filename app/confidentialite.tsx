import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

export default function PrivacyScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Link href="/" asChild>
        <Pressable><Text style={styles.backLink}>Retour à Révilo</Text></Pressable>
      </Link>
      <Text style={styles.title}>Politique de confidentialité</Text>
      <Text style={styles.notice}>
        Brouillon à compléter et à valider avant publication. Révilo ne doit pas être diffusée tant que
        l’identité du responsable, ses coordonnées et les informations du projet Supabase ne sont pas renseignées.
      </Text>

      <Text style={styles.heading}>Données utilisées</Text>
      <Text style={styles.body}>
        Si tu crées un compte, Révilo utilise ton adresse e-mail pour l’authentification. Les cours,
        contrôles, chapitres, disponibilités, séances de révision, paquets de cartes, cartes, progressions
        et résultats de quiz associés au compte sont synchronisés avec Supabase.
      </Text>
      <Text style={styles.body}>
        En mode hors ligne, les cours et les cartes sont conservés dans le stockage local de l’appareil.
        Ils ne sont pas synchronisés automatiquement avec un compte.
      </Text>

      <Text style={styles.heading}>Finalités et prestataires</Text>
      <Text style={styles.body}>
        Ces données servent à gérer le compte, calculer le planning et mémoriser la progression des révisions.
        Supabase fournit l’authentification et la base de données. La région d’hébergement et les durées de
        conservation doivent être précisées par l’éditeur avant publication.
      </Text>
      <Text style={styles.body}>
        Les notifications push et la publicité ne sont pas activées dans cette version.
      </Text>

      <Text style={styles.heading}>Suppression et droits</Text>
      <Text style={styles.body}>
        La suppression du compte est proposée dans Profil et supprime les données rattachées au compte.
        Pour exercer tes droits d’accès, de rectification ou d’opposition, contacte le responsable du traitement.
      </Text>
      <Text style={styles.body}>
        Responsable du traitement : identité et adresse de l’éditeur à compléter. Contact : adresse e-mail à compléter.
        Les règles applicables aux mineurs doivent être définies avant l’ouverture du service au public.
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
