from sentence_transformers import SentenceTransformer
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Load model (downloads automatically first time)
logger.info("Loading embedding model 'all-MiniLM-L6-v2'...")
try:
    model = SentenceTransformer('all-MiniLM-L6-v2')
    logger.info("Model loaded successfully!")
except Exception as e:
    logger.error(f"Failed to load model: {str(e)}")
    raise

@app.route('/embed', methods=['POST'])
def embed():
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text or len(text) < 10:
            return jsonify({'error': 'Text must be at least 10 characters'}), 400
        
        logger.info(f"Generating embedding for text (length: {len(text)} chars)")
        
        # Generate embedding locally (no API calls, runs on CPU)
        embedding = model.encode(text, normalize_embeddings=True)
        
        # Convert numpy array to list
        embedding_list = embedding.tolist()
        
        logger.info(f"✅ Generated embedding: {len(embedding_list)} dimensions")
        logger.debug(f"Sample values: {embedding_list[:5]}")
        
        return jsonify({
            'embedding': embedding_list,
            'dimensions': len(embedding_list)
        })
    except Exception as e:
        logger.error(f"❌ Error generating embedding: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model': 'all-MiniLM-L6-v2',
        'service': 'python-embedding-service'
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"🚀 Starting embedding service on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)

