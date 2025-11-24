import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function ensureAuth() {
  if (auth.currentUser) return auth.currentUser;
  const res = await signInAnonymously(auth);
  return res.user;
}

// Alunos
export async function salvarAluno(nome) {
  await ensureAuth();
  if (!nome.trim()) throw new Error("Nome obrigatório");

  // verifica duplicado
  const q = query(collection(db, "alunos"), where("nome", "==", nome));
  const snap = await getDocs(q);
  if (!snap.empty) return { id: snap.docs[0].id, nome, existed: true };

  const docRef = await addDoc(collection(db, "alunos"), {
    nome,
    created_at: new Date().toISOString(),
  });
  return { id: docRef.id, nome, existed: false };
}

export async function listarAlunos() {
  await ensureAuth();
  const q = query(collection(db, "alunos"), orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function renomearAluno(id, novoNome) {
  await ensureAuth();
  await updateDoc(doc(db, "alunos", id), { nome: novoNome });
}

export async function excluirAluno(id) {
  await ensureAuth();
  // opcional: apagar treinos ligados a ele
  const treinosQ = query(
    collection(db, "treinos"),
    where("alunoId", "==", id)
  );
  const snap = await getDocs(treinosQ);
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }
  await deleteDoc(doc(db, "alunos", id));
}

// Treinos
export async function salvarTreino(alunoId, alunoNome, treino) {
  await ensureAuth();
  if (!alunoId) throw new Error("Aluno não definido");
  if (!Array.isArray(treino)) throw new Error("Treino inválido");

  const docRef = await addDoc(collection(db, "treinos"), {
    alunoId,
    alunoNome,
    treino,
    created_at: new Date().toISOString(),
  });
  return docRef.id;
}

export async function listarTreinos(alunoId) {
  await ensureAuth();
  if (!alunoId) return [];
  const q = query(
    collection(db, "treinos"),
    where("alunoId", "==", alunoId),
    orderBy("created_at", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
