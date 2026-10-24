// Schedule configuration
// Each entry: { accountId, posts: [{ time: "HH:MM", caption, mediaUrls }] }
// Times are in UTC

export const schedule = [
  {
    accountId: "YOUR_ACCOUNT_ID_HERE",
    posts: [
      {
        time: "09:00",
        caption: "Morning post #fyp #viral",
        mediaUrls: ["https://your-cdn.com/image1.jpg"],
      },
      {
        time: "18:00",
        caption: "Evening post #fyp #viral",
        mediaUrls: ["https://your-cdn.com/image2.jpg"],
      },
    ],
  },
  // Add more accounts:
  // {
  //   accountId: "SECOND_ACCOUNT_ID",
  //   posts: [
  //     { time: "10:00", caption: "...", mediaUrls: ["..."] },
  //     { time: "19:00", caption: "...", mediaUrls: ["..."] },
  //   ],
  // },
];
