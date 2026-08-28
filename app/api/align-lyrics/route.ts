import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const prompt = formData.get('prompt') as string

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
      prompt: prompt || undefined,
    })

    return NextResponse.json({
      segments: transcription.segments || [],
      words: transcription.words || [],
    })
  } catch (error: any) {
    console.error('Whisper alignment API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to align lyrics' },
      { status: 500 }
    )
  }
}