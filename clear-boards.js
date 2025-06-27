const admin = require('./backend/dist/config/firebaseAdmin').default;

async function clearBoards() {
  try {
    console.log('Connecting to Firestore...');
    const firestore = admin.firestore();
    
    console.log('Fetching all boards...');
    const snapshot = await firestore.collection('boards').get();
    
    if (snapshot.empty) {
      console.log('No boards found to delete.');
      return;
    }
    
    console.log(`Found ${snapshot.size} boards to delete`);
    
    const deletePromises = snapshot.docs.map(doc => {
      console.log(`Deleting board: ${doc.id}`);
      return doc.ref.delete();
    });
    
    await Promise.all(deletePromises);
    
    console.log('All boards deleted successfully!');
  } catch (error) {
    console.error('Error deleting boards:', error);
  } finally {
    process.exit(0);
  }
}

clearBoards(); 