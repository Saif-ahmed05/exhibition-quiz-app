// src/lib/quizSets.js
// Cyber Security Awareness quiz sets for a live exhibition game.
// Each set must have exactly 4 questions.
// Each question has 4 options. `answer` is the correct option number (1–4).
// The correct code = answers concatenated, e.g. answers [2,4,1,1] → code "2411"
//
// CATEGORIES define the audience types shown in the host UI.
// QUIZ_SETS is a flat array; each set has a unique `id` and a `category` linking
// it back to a CATEGORY. Multiple sets per category enable non-repeating rotation.

export const CATEGORIES = [
  { id: 'technical', name: 'Technical People' },
  { id: 'students', name: 'School Students' },
  { id: 'normal', name: 'Normal People' },
];

export const QUIZ_SETS = [
  // ─── Technical People — Set 1 ───────────────────────────────────────────────

  {
    id: 'technical_1',
    category: 'technical',
    questions: [
      {
        text: 'Which protocol ensures encrypted communication between a browser and a web server?',
        options: ['FTP', 'HTTPS', 'Telnet', 'SMTP'],
        answer: 2, // HTTPS
      },
      {
        text: 'What type of attack exploits input fields to execute malicious SQL commands on a database?',
        options: ['XSS', 'DDoS', 'SQL Injection', 'Phishing'],
        answer: 3, // SQL Injection
      },
      {
        text: 'In a Zero Trust security model, what is the default assumption about any user or device?',
        options: [
          'Trusted if on the corporate network',
          'Trusted after first login',
          'Never trusted — always verify',
          'Trusted if using a VPN',
        ],
        answer: 3, // Never trusted — always verify
      },
      {
        text: 'What does a firewall primarily do?',
        options: [
          'Encrypts stored files',
          'Filters network traffic based on rules',
          'Scans for viruses on disk',
          'Manages user passwords',
        ],
        answer: 2, // Filters network traffic based on rules
      },
    ],
    // Correct code: 2332
  },

  // ─── Technical People — Set 2 ───────────────────────────────────────────────

  {
    id: 'technical_2',
    category: 'technical',
    questions: [
      {
        text: 'Which of the following is a common indicator of a phishing email?',
        options: [
          'Sent from a known colleague',
          'Contains a mismatched or suspicious URL',
          'Has a company logo',
          'Written in formal language',
        ],
        answer: 2, // Contains a mismatched or suspicious URL
      },
      {
        text: 'What does MFA stand for in cyber security?',
        options: [
          'Multiple File Access',
          'Multi-Factor Authentication',
          'Main Firewall Application',
          'Managed Filter Architecture',
        ],
        answer: 2, // Multi-Factor Authentication
      },
      {
        text: 'What type of malware locks your files and demands payment to unlock them?',
        options: ['Spyware', 'Adware', 'Worm', 'Ransomware'],
        answer: 4, // Ransomware
      },
      {
        text: 'What is the purpose of penetration testing?',
        options: [
          'To install security patches',
          'To back up critical data',
          'To simulate attacks and find vulnerabilities',
          'To monitor network bandwidth',
        ],
        answer: 3, // To simulate attacks and find vulnerabilities
      },
    ],
    // Correct code: 2243
  },

  // ─── Normal People — Set 1 ──────────────────────────────────────────────────

  {
    id: 'normal_1',
    category: 'normal',
    questions: [
      {
        text: 'You receive an email saying "Your account will be closed in 24 hours — click here to verify." What should you do?',
        options: [
          'Click the link immediately',
          'Forward it to all your contacts',
          'Don\'t click — go to the official website directly to check',
          'Reply and ask for more details',
        ],
        answer: 3, // Don't click — go to the official website directly
      },
      {
        text: 'What is the safest type of password?',
        options: [
          'Your birthday',
          'A long mix of letters, numbers, and symbols',
          'The word "password"',
          'Your pet\'s name',
        ],
        answer: 2, // A long mix of letters, numbers, and symbols
      },
      {
        text: 'What should you do before downloading an app on your phone?',
        options: [
          'Download it from any website',
          'Check the reviews, developer, and permissions first',
          'Ask a friend to send you the file',
          'Just install it if the icon looks nice',
        ],
        answer: 2, // Check reviews, developer, and permissions
      },
      {
        text: 'What does the padlock icon in your browser\'s address bar mean?',
        options: [
          'The website is government approved',
          'The website is free of viruses',
          'The connection between you and the site is encrypted',
          'The website cannot track you',
        ],
        answer: 3, // The connection is encrypted
      },
    ],
    // Correct code: 3223
  },

  // ─── Normal People — Set 2 ──────────────────────────────────────────────────

  {
    id: 'normal_2',
    category: 'normal',
    questions: [
      {
        text: 'Why is it risky to use the same password for multiple accounts?',
        options: [
          'It uses too much memory on your phone',
          'Websites don\'t allow it',
          'If one account is hacked, all your accounts are at risk',
          'It makes your internet slower',
        ],
        answer: 3, // If one account is hacked, all are at risk
      },
      {
        text: 'What is "two-factor authentication" (2FA)?',
        options: [
          'Using two different passwords',
          'Logging in from two devices',
          'A second verification step, like a code sent to your phone',
          'Having two antivirus programs installed',
        ],
        answer: 3, // A second verification step
      },
      {
        text: 'You find a USB drive on the ground at work. What should you do?',
        options: [
          'Plug it into your computer to see what\'s on it',
          'Give it to a colleague to check',
          'Hand it to your IT department — do not plug it in',
          'Format it and use it for yourself',
        ],
        answer: 3, // Hand it to IT — do not plug it in
      },
      {
        text: 'What is the best thing to do when your software asks you to install an update?',
        options: [
          'Ignore it — updates slow down your device',
          'Install it as soon as possible — updates fix security holes',
          'Wait a year to make sure it\'s safe',
          'Uninstall the software instead',
        ],
        answer: 2, // Install it as soon as possible
      },
    ],
    // Correct code: 3332
  },

  // ─── School Students — Set 1 ────────────────────────────────────────────────

  {
    id: 'students_1',
    category: 'students',
    questions: [
      {
        text: 'A stranger online asks for your home address. What should you do?',
        options: [
          'Tell them — they seem friendly',
          'Give a fake address',
          'Never share personal info with strangers online',
          'Ask for their address first',
        ],
        answer: 3, // Never share personal info with strangers
      },
      {
        text: 'What is a strong password?',
        options: [
          '123456',
          'Your name in lowercase',
          'A long mix of letters, numbers, and special characters',
          'The word "password"',
        ],
        answer: 3, // A long mix of letters, numbers, and special characters
      },
      {
        text: 'You get a message from a "friend" asking for your password. What should you do?',
        options: [
          'Send it — they\'re your friend',
          'Never share your password with anyone',
          'Only share it if they say "please"',
          'Post it on social media so you don\'t forget',
        ],
        answer: 2, // Never share your password with anyone
      },
      {
        text: 'What does it mean when a website address starts with "https"?',
        options: [
          'The site is very fast',
          'The site is only for adults',
          'The connection to the site is secure and encrypted',
          'The site is free to use',
        ],
        answer: 3, // The connection is secure and encrypted
      },
    ],
    // Correct code: 3323
  },

  // ─── School Students — Set 2 ────────────────────────────────────────────────

  {
    id: 'students_2',
    category: 'students',
    questions: [
      {
        text: 'Someone you don\'t know sends you a link in a game chat. What should you do?',
        options: [
          'Click it — it might be a free prize',
          'Don\'t click it — it could be dangerous',
          'Share it with your friends',
          'Click it if it looks cool',
        ],
        answer: 2, // Don't click it
      },
      {
        text: 'What information should you NEVER share online?',
        options: [
          'Your favourite colour',
          'Your password and home address',
          'Your favourite movie',
          'Your favourite food',
        ],
        answer: 2, // Your password and home address
      },
      {
        text: 'What should you do if you see something scary or upsetting online?',
        options: [
          'Keep it to yourself',
          'Share it with other kids',
          'Tell a trusted adult like a parent or teacher',
          'Try to find more of it',
        ],
        answer: 3, // Tell a trusted adult
      },
      {
        text: 'Why should you log out of your account on a shared computer?',
        options: [
          'To make the computer faster',
          'So the next person can\'t access your stuff',
          'Because it saves electricity',
          'You don\'t need to — it\'s fine to stay logged in',
        ],
        answer: 2, // So the next person can't access your stuff
      },
    ],
    // Correct code: 2232
  },

  // ─── School Students — Set 3 ────────────────────────────────────────────────

  {
    id: 'students_3',
    category: 'students',
    questions: [
      {
        text: 'What is cyberbullying?',
        options: [
          'Playing video games online',
          'Being mean to someone using phones or the internet',
          'Sending funny memes to friends',
          'Watching too many YouTube videos',
        ],
        answer: 2, // Being mean to someone using phones or the internet
      },
      {
        text: 'An app asks to access your camera, microphone, and contacts just to play a simple game. Is this normal?',
        options: [
          'Yes — all apps need that',
          'No — a simple game shouldn\'t need all that access',
          'Only if the game is popular',
          'Yes — just tap "Allow" always',
        ],
        answer: 2, // No — a simple game shouldn't need all that access
      },
      {
        text: 'What should you do if someone online asks you to keep a secret from your parents?',
        options: [
          'Keep the secret — they trust you',
          'Tell only your best friend',
          'Tell a parent or trusted adult right away',
          'Ignore it and keep chatting',
        ],
        answer: 3, // Tell a parent or trusted adult right away
      },
      {
        text: 'Why is it important to use different passwords for different accounts?',
        options: [
          'So you can remember which account is which',
          'It doesn\'t matter — one password is fine',
          'If one gets stolen, the others stay safe',
          'Because websites make you do it',
        ],
        answer: 3, // If one gets stolen, the others stay safe
      },
    ],
    // Correct code: 2233
  },

  // ─── School Students — Set 4 ────────────────────────────────────────────────

  {
    id: 'students_4',
    category: 'students',
    questions: [
      {
        text: 'What is a "virus" on a computer?',
        options: [
          'A bug that makes you sick',
          'A harmful program that can damage your files or spy on you',
          'A type of computer game',
          'An update from the computer company',
        ],
        answer: 2, // A harmful program
      },
      {
        text: 'You receive a pop-up that says "You won a free iPhone! Click here!" What should you do?',
        options: [
          'Click it — free phones are great!',
          'Close it — it\'s almost certainly a scam',
          'Enter your details to claim it',
          'Share it with friends so they can win too',
        ],
        answer: 2, // Close it — it's almost certainly a scam
      },
      {
        text: 'Is it safe to connect to any free Wi-Fi you find in public?',
        options: [
          'Yes — free Wi-Fi is always safe',
          'No — hackers can use fake Wi-Fi to steal your data',
          'Only if it doesn\'t ask for a password',
          'Yes — as long as the signal is strong',
        ],
        answer: 2, // No — hackers can use fake Wi-Fi
      },
      {
        text: 'Before posting a photo online, what should you think about?',
        options: [
          'Nothing — just post it',
          'Whether it shows private info like your school name or address',
          'How many likes it will get',
          'Only whether the photo looks cool',
        ],
        answer: 2, // Whether it shows private info
      },
    ],
    // Correct code: 2222
  },
];
