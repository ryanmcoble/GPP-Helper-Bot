let natural = require('natural');

module.exports = function() {

    /**
     * Stopwords list taken from http://www.ranks.nl/stopwords
     */

    let stopwords = ["a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"];
    let stopStems = stopwords.map(natural.PorterStemmer.stem);

    let BM25 = function() {
        this.averageDocumentLength = 0;
        this.totalDocumentTermLength = 0;
        this.totalDocuments = 0;
        this.documents = {};
        this.terms = {};
        this.k1 = 1.2;
	    this.b = 0.25;
    };
    BM25.Tokenize = function(text) {
        text = text
            .toLowerCase()
            .replace(/\W/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map(function(a) { return natural.PorterStemmer.stem(a); });
    
        // Filter out stopStems
        var out = [];
        for (var i = 0, len = text.length; i < len; i++) {
            if (stopStems.indexOf(text[i]) === -1) {
                out.push(text[i]);
            }
        }
    
        return out;
    };

    // add a document to list of documents
    BM25.prototype.addDocument = function(doc) {
        if (typeof doc.id === 'undefined') { throw new Error(1000, 'ID is a required property of documents.'); };
        if (typeof doc.body === 'undefined') { throw new Error(1001, 'Body is a required property of documents.'); };
        if (typeof doc.message === 'undefined') { throw new Error(1000, 'Message is a required property of documents.'); };
    
        // Raw tokenized list of words
        var tokens = BM25.Tokenize(doc.body);
    
        // Will hold unique terms and their counts and frequencies
        var _terms = {};
    
        // docObj will eventually be added to the documents database
        var docObj = {id: doc.id, tokens: tokens, body: doc.body};
    
        // Count number of terms
        docObj.termCount = tokens.length;
    
        // Increment totalDocuments
        this.totalDocuments++;
    
        // Readjust averageDocumentLength
        this.totalDocumentTermLength += docObj.termCount;
        this.averageDocumentLength = this.totalDocumentTermLength / this.totalDocuments;
    
        // Calculate term frequency
        // First get terms count
        for (var i = 0, len = tokens.length; i < len; i++) {
            var term = tokens[i];
            if (!_terms[term]) { 
                _terms[term] = {
                    count: 0,
                    freq: 0
                }; 
            };
            _terms[term].count++;
        }
    
        // Then re-loop to calculate term frequency.
        // We'll also update inverse document frequencies here.
        var keys = Object.keys(_terms);
        for (var i = 0, len = keys.length; i < len; i++) {
            var term = keys[i];
            // Term Frequency for this document.
            _terms[term].freq = _terms[term].count / docObj.termCount;
    
            // Inverse Document Frequency initialization
            if (!this.terms[term]) {
                this.terms[term] = {
                    n: 0, // Number of docs this term appears in, uniquely
                    idf: 0
                };
            }
    
            this.terms[term].n++;
        };
    
        // Calculate inverse document frequencies
        // This is SLOWish so if you want to index a big batch of documents,
        // comment this out and run it once at the end of your addDocuments run
        // If you're only indexing a document or two at a time you can leave this in.
        this.updateIdf();
    
        // Add docObj to docs db
        docObj.terms = _terms;
        this.documents[docObj.id] = docObj;
    };

    // update the inverse document frequency
    BM25.prototype.updateIdf = function() {
        var keys = Object.keys(this.terms);
        for (var i = 0, len = keys.length; i < len; i++) {
            var term = keys[i];
            var num = (this.totalDocuments - this.terms[term].n + 0.5);
            var denom = (this.terms[term].n + 0.5);
            this.terms[term].idf = Math.max(Math.log10(num / denom), 0.01);
        }
    };

    // search the documents given a query
    BM25.prototype.search = function(query) {
        var queryTerms = BM25.Tokenize(query);
        var results = [];
    
        // Look at each document in turn. There are better ways to do this with inverted indices.
        var keys = Object.keys(this.documents);
        for (var j = 0, nDocs = keys.length; j < nDocs; j++) {
            var id = keys[j];
            // The relevance score for a document is the sum of a tf-idf-like
            // calculation for each query term.
            this.documents[id]._score = 0;
    
            // Calculate the score for each query term
            for (var i = 0, len = queryTerms.length; i < len; i++) {
                var queryTerm = queryTerms[i];
    
                // We've never seen this term before so IDF will be 0.
                // Means we can skip the whole term, it adds nothing to the score
                // and isn't in any document.
                if (typeof this.terms[queryTerm] === 'undefined') {
                    continue;
                }
    
                // This term isn't in the document, so the TF portion is 0 and this
                // term contributes nothing to the search score.
                if (typeof this.documents[id].terms[queryTerm] === 'undefined') {
                    continue;
                }
    
                // The term is in the document, let's go.
                // The whole term is :
                // IDF * (TF * (k1 + 1)) / (TF + k1 * (1 - b + b * docLength / avgDocLength))
    
                // IDF is pre-calculated for the whole docset.
                var idf = this.terms[queryTerm].idf;
                // Numerator of the TF portion.
                var num = this.documents[id].terms[queryTerm].count * (this.k1 + 1);
                // Denomerator of the TF portion.
                var denom = this.documents[id].terms[queryTerm].count 
                    + (this.k1 * (1 - this.b + (this.b * this.documents[id].termCount / this.averageDocumentLength)));

                // Add this query term to the score
                this.documents[id]._score += idf * num / denom;
            }
    
            if (!isNaN(this.documents[id]._score) && this.documents[id]._score > 0) {
                results.push(this.documents[id]);
            }
        }
    
        results.sort(function(a, b) { return b._score - a._score; });
        return results.slice(0, 10);
    };

    // get all documents
    BM25.prototype.allDocuments = function() {
        return this.documents;
    };

    return new BM25;
};