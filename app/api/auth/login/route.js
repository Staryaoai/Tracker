import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ message: 'Password is required.' }, { status: 400 });
    }

    const sitePassword = process.env.LOGIN_PASSWORD;

    if (!sitePassword) {
      console.error('LOGIN_PASSWORD environment variable is not set on the server.');
      return NextResponse.json({ message: 'Server configuration error.' }, { status: 500 });
    }

    if (password === sitePassword) {
      // Password matches
      // For simplicity, we'll just return a success.
      // In more complex apps, you might issue a token (JWT) here.
      return NextResponse.json({ success: true, message: 'Login successful.' });
    } else {
      // Password does not match
      return NextResponse.json({ success: false, message: 'Invalid password.' }, { status: 401 });
    }

  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({ message: 'An error occurred during login.' }, { status: 500 });
  }
}