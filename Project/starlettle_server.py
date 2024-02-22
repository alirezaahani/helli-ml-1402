from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from transformers import pipeline
import asyncio
import sqlite3

DATABASE_PATH = 'database.sqlite'
database = sqlite3.connect(DATABASE_PATH)
cur = database.cursor()
cur.execute('CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY AUTOINCREMENT, text_ TEXT, label_ INTEGER)')
database.commit()

from transformers import AutoTokenizer, pipeline
from optimum.intel import OVModelForSequenceClassification

async def server_loop(q):
    ov_model = OVModelForSequenceClassification.from_pretrained("./OV/Model")
    tokenizer = AutoTokenizer.from_pretrained("./OV/Tokenizer")
    classifier = pipeline("text-classification", model=ov_model, tokenizer=tokenizer)
    
    while True:
        (queries, response_q) = await q.get()
        outputs = [
            {
                'index': i, 
                'text': queries[i], 
                'label': output['label'], 
                'score': output['score']
            }
            for i, output in enumerate(classifier(queries))
        ]
        await response_q.put(outputs)

async def classify(request):
    queries = request.query_params.getlist('q')
    
    response_q = asyncio.Queue()
    await request.app.model_queue.put((queries, response_q))
    outputs = await response_q.get()

    return JSONResponse(outputs)

async def feedback(request):
    text = request.query_params.get('text')
    label = request.query_params.get('label')
    
    cur = database.cursor()
    cur.execute('INSERT INTO feedback(text_, label_) VALUES (?, ?);', (text, label, ))
    database.commit()

    return JSONResponse({ 'ok': True })

app = Starlette(
    debug=True,
    routes=[
        Route("/classify", classify, methods=["GET"]),
        Route("/feedback", feedback, methods=["GET"]),
    ],
)


@app.on_event("startup")
async def startup_event():
    q = asyncio.Queue()
    app.model_queue = q
    asyncio.create_task(server_loop(q))