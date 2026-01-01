// لیست درس‌ها برای حالت آفلاین (ضد فیلتر)
// فرمت فایل‌های ضمیمه: "اسم|لینک , اسم|لینک"

const LOCAL_PLAYLIST = [
    { 
        id: "1", 
        title: "درس اول: آشنایی با کلاس", 
        file: "https://dl.example.com/video1.mp4", 
        attachment: "" 
    },
    { 
        id: "2", 
        title: "درس دوم: ریاضی (با یک ضمیمه)", 
        file: "https://dl.example.com/video2.mp4", 
        attachment: "دانلود جزوه|https://site.com/jozve.pdf" 
    },
    { 
        id: "3", 
        title: "درس سوم: علوم (با چند ضمیمه)", 
        file: "https://dl.example.com/video3.mp4", 
        // 👇 نمونه درس با چند فایل ضمیمه (با ویرگول جدا شدند)
        attachment: "خلاصه درس|https://site.com/pdf1.pdf , نمونه سوال|https://site.com/pdf2.pdf , پاسخنامه|https://site.com/pdf3.pdf" 
    }
];
