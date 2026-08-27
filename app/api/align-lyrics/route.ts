import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 })
    }

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment', 'word'],
    })

    return NextResponse.json({
      segments: transcription.segments || [],
      words: transcription.words || [],
    })
  } catch (error: any) {
    console.error('Whisper Alignment Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to align audio with Whisper' },
      { status: 500 }
    )
  }
}