#!pip install -U transformers optimum[openvino,nncf] flask --quiet

from flask import Flask
from flask import request
from flask import jsonify

from flask import g
import sqlite3

app = Flask(__name__)

DATABASE_PATH = 'database.sqlite'

def get_database():
    db = getattr(g, '_db', None)
    if db is None:
        db = g._db = sqlite3.connect(DATABASE_PATH)
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_db', None)
    if db is not None:
        db.close()

with app.app_context():
  cur = get_database().cursor()
  cur.execute('CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY AUTOINCREMENT, text_ TEXT, label_ INTEGER)')
  get_database().commit()

from transformers import AutoTokenizer, pipeline
from optimum.intel import OVModelForSequenceClassification

ov_model = OVModelForSequenceClassification.from_pretrained("./OV/Model")
tokenizer = AutoTokenizer.from_pretrained("./OV/Tokenizer")
classifier = pipeline("text-classification", model=ov_model, tokenizer=tokenizer)

@app.route('/', methods=['POST', 'GET'])
def index():
  return """
  <form action='/classify' method="get">
    <input type="button" value="Add TextBox" onclick="add_field();">
    <input type="button" value="Remove TextBox" onclick="remove_field();">
    <ol id="field_div">

    </ol>
    <button type='submit'>Submit</button>
  </form>

  <script>
    const add_field = () => {
      let total_text = document.getElementsByClassName("input_text").length + 1;
      let field_div = document.getElementById("field_div");
      let new_input = "<li id='input_text_' + total_text><input type='text' class='input_text' name='q'></li>";
      field_div.insertAdjacentHTML('beforeend', new_input);
    }
    const remove_field = () => {
      let total_text = document.getElementsByClassName("input_text").length
      document.getElementById('input_text_' + total_text).remove();
    }
  </script>
  """


@app.route('/classify', methods=['POST', 'GET'])
def classify():
    queries = request.args.getlist('q')
    outputs = classifier(queries)

    results = []

    for i, output in enumerate(outputs):
      label = output['label']
      score = output['score']

      results.append({
        'index': i,
        'text': queries[i],
        'label': label,
        'score': score,
      })


    return jsonify(
      results
    )

@app.route('/feedback', methods=['POST', 'GET'])
def feedback():
    text = request.args.get('text')
    label = request.args.get('label')
    
    db = get_database()
    cur = db.cursor()
    cur.execute('INSERT INTO feedback(text_, label_) VALUES (?, ?);', (text, label, ))
    db.commit()

    return jsonify({ 'ok': True })

app.run()