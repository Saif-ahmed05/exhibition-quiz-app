// src/lib/quizSets.js
// Cyber Security Awareness quiz sets for a live exhibition game.
// Each set must have exactly 4 questions.
// Each question has 4 options. `answer` is the correct option number (1–4).
// The correct code = answers concatenated, e.g. answers [3,2,3,3] → code "3233"
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
        text: 'Which is the best clue that a login page may be fake?',
        options: ['The page has a logo', 'The page uses blue colors', 'The domain name is slightly changed', 'The page loads fast'],
        answer: 3, // The domain name is slightly changed
      },
      {
        text: 'In a phishing attack, what usually happens after the victim enters username and password?',
        options: ['The browser deletes the page', 'The fake page sends the data to the attacker', 'The website becomes slower', 'The phone restarts'],
        answer: 2, // The fake page sends the data to the attacker
      },
      {
        text: 'Which item is most useful for reducing account compromise after a password leak?',
        options: ['Turn off Wi-Fi', 'Increase screen brightness', 'Enable 2-step verification', 'Clear browser history only'],
        answer: 3, // Enable 2-step verification
      },
      {
        text: 'Which app permission request should be considered suspicious for a simple torch app?',
        options: ['Flashlight access', 'Battery usage', 'Location access', 'Screen brightness'],
        answer: 3, // Location access
      },
    ],
    // Correct code: 3233
  },

  // ─── Technical People — Set 2 ───────────────────────────────────────────────

  {
    id: 'technical_2',
    category: 'technical',
    questions: [
      {
        text: 'Why do attackers often use urgency in phishing messages?',
        options: ['To make the internet faster', 'To stop users from thinking carefully', 'To improve password strength', 'To reduce file size'],
        answer: 2, // To stop users from thinking carefully
      },
      {
        text: 'Which example is most likely a malicious domain?',
        options: ['google.com', 'amazon.com', 'school.edu', 'amazon-offer.xyz'],
        answer: 4, // amazon-offer.xyz
      },
      {
        text: 'How does AI help cyber attackers today?',
        options: ['It automatically repairs devices', 'It makes fake emails, chats, voices, and videos more believable', 'It blocks all fake websites', 'It removes malware from phones'],
        answer: 2, // It makes fake emails, chats, voices, and videos more believable
      },
      {
        text: 'Which is the safest action before logging into an account from a link?',
        options: ['Check the full URL carefully', 'Click quickly before the page closes', 'Ignore spelling mistakes', 'Send your OTP first'],
        answer: 1, // Check the full URL carefully
      },
    ],
    // Correct code: 2421
  },

  // ─── School Students — Set 1 ────────────────────────────────────────────────

  {
    id: 'students_1',
    category: 'students',
    questions: [
      {
        text: 'What is phishing?',
        options: ['A video game', 'A fake page that steals what you type', 'A type of camera', 'A strong password'],
        answer: 2, // A fake page that steals what you type
      },
      {
        text: 'Which one looks suspicious?',
        options: ['google.com', 'gooogle.com', 'school.com', 'youtube.com'],
        answer: 2, // gooogle.com
      },
      {
        text: 'What should you check before logging in?',
        options: ['The color of the page', 'The number of pictures', 'The full website link', 'The phone wallpaper'],
        answer: 3, // The full website link
      },
      {
        text: 'If a stranger asks for your OTP, what should you do?',
        options: ['Share it quickly', 'Share only half', 'Never share it', 'Post it online'],
        answer: 3, // Never share it
      },
    ],
    // Correct code: 2233
  },

  // ─── School Students — Set 2 ────────────────────────────────────────────────

  {
    id: 'students_2',
    category: 'students',
    questions: [
      {
        text: 'What makes a strong password better?',
        options: ['Using your name only', 'Using 12+ characters', 'Using only numbers', 'Using "123456"'],
        answer: 2, // Using 12+ characters
      },
      {
        text: 'Which password is stronger?',
        options: ['saif123', 'password', 'MfPws2019@', '11111111'],
        answer: 3, // MfPws2019@
      },
      {
        text: 'If an app asks for too many permissions, what should you do?',
        options: ['Accept everything', 'Check if the permission makes sense', 'Ignore the app name', 'Install it faster'],
        answer: 2, // Check if the permission makes sense
      },
      {
        text: 'What should you do if your account may be hacked?',
        options: ['Do nothing', 'Change your password quickly', 'Delete your photos only', 'Turn off the screen'],
        answer: 2, // Change your password quickly
      },
    ],
    // Correct code: 2322
  },

  // ─── School Students — Set 3 ────────────────────────────────────────────────

  {
    id: 'students_3',
    category: 'students',
    questions: [
      {
        text: 'A story disappears after 24 hours. Does that mean it is fully gone?',
        options: ['Yes, always', 'No, it can still be copied or screen-recorded', 'Yes, if it has music', 'Yes, if friends liked it'],
        answer: 2, // No, it can still be copied or screen-recorded
      },
      {
        text: 'Before posting online, what is a smart question to ask?',
        options: ['Will this get many likes?', 'Is the font nice?', 'Would I be okay if a teacher or parent sees this?', 'Is my battery full?'],
        answer: 3, // Would I be okay if a teacher or parent sees this?
      },
      {
        text: 'Which emotion do scammers often use?',
        options: ['Fear and urgency', 'Happiness and peace', 'Sleep and silence', 'Exercise and health'],
        answer: 1, // Fear and urgency
      },
      {
        text: 'Which is safer?',
        options: ['Reusing the same password everywhere', 'Using different passwords for different accounts', 'Sharing passwords with friends', 'Writing your password publicly'],
        answer: 2, // Using different passwords for different accounts
      },
    ],
    // Correct code: 2312
  },

  // ─── School Students — Set 4 ────────────────────────────────────────────────

  {
    id: 'students_4',
    category: 'students',
    questions: [
      {
        text: 'What is one sign of a fake app?',
        options: ['Trusted developer and good reviews', 'Strange name and unnecessary permissions', 'Many downloads from official store', 'Clear company details'],
        answer: 2, // Strange name and unnecessary permissions
      },
      {
        text: 'If you clicked something suspicious, what should you do first?',
        options: ['Change your password', 'Post about it online', 'Ignore it', 'Open more links'],
        answer: 1, // Change your password
      },
      {
        text: 'What does 2-step verification do?',
        options: ['Makes your phone louder', 'Adds extra protection to your account', 'Deletes fake apps', 'Changes your email address'],
        answer: 2, // Adds extra protection to your account
      },
      {
        text: 'Who should a student tell if something feels unsafe online?',
        options: ['A scammer', 'Nobody', 'A trusted adult, parent, or teacher', 'Any stranger online'],
        answer: 3, // A trusted adult, parent, or teacher
      },
    ],
    // Correct code: 2123
  },

  // ─── Normal People — Set 1 ──────────────────────────────────────────────────

  {
    id: 'normal_1',
    category: 'normal',
    questions: [
      {
        text: 'Which message is most likely a scam?',
        options: ['"Your account will be blocked. Send OTP now."', '"Your class starts at 9 AM."', '"Meeting moved to Monday."', '"Lunch is ready."'],
        answer: 1, // "Your account will be blocked. Send OTP now."
      },
      {
        text: 'What should you never share with anyone?',
        options: ['Your favorite color', 'Your OTP', 'Your shoe size', 'Your birthday month only'],
        answer: 2, // Your OTP
      },
      {
        text: 'Which is the safest way to open an important account?',
        options: ['Use the official app or type the official website yourself', 'Click every message link', 'Trust any forwarded link', 'Use any random pop-up'],
        answer: 1, // Use the official app or type the official website yourself
      },
      {
        text: 'If your password is stolen, what should you do?',
        options: ['Keep using it', 'Change that password and similar passwords', 'Tell everyone the password', 'Buy a new phone immediately'],
        answer: 2, // Change that password and similar passwords
      },
    ],
    // Correct code: 1212
  },

  // ─── Normal People — Set 2 ──────────────────────────────────────────────────

  {
    id: 'normal_2',
    category: 'normal',
    questions: [
      {
        text: 'Why do fake pages work so well?',
        options: ['Because they are always faster', 'Because they look familiar and real', 'Because they have more ads', 'Because they are colorful'],
        answer: 2, // Because they look familiar and real
      },
      {
        text: 'Which is a good password habit?',
        options: ['Use one password for all accounts', 'Use personal details only', 'Use a long password with letters, numbers, and symbols', 'Share it with friends for safety'],
        answer: 3, // Use a long password with letters, numbers, and symbols
      },
      {
        text: 'How can AI be misused by scammers?',
        options: ['To make fake voice calls and realistic scam messages', 'To repair your phone battery', 'To clean your email inbox', 'To improve your camera automatically'],
        answer: 1, // To make fake voice calls and realistic scam messages
      },
      {
        text: 'What should you do if you feel something online is suspicious?',
        options: ['Rush and complete it', 'Stop, check carefully, and act fast if needed', 'Ignore all security warnings', 'Share the link with others'],
        answer: 2, // Stop, check carefully, and act fast if needed
      },
    ],
    // Correct code: 2312
  },
];
