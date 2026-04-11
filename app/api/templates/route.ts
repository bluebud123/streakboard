import { NextResponse } from "next/server";

export interface TemplateMetadata {
  id: string;
  title: string;
  category: string;
  description: string;
  filename: string;
  itemCount: number;
  contributor?: string;
}

const TEMPLATES: TemplateMetadata[] = [
  {
    id: "orthopaedic-surgery",
    title: "Orthopaedic Surgery Fellowship Exam",
    category: "Medicine",
    description:
      "Comprehensive topic list for FRCS (Orth) / fellowship exams covering basic science, trauma, arthroplasty, spine, sports, and hand surgery.",
    filename: "orthopaedic-surgery.md",
    itemCount: 170,
    contributor: "blue",
  },
  {
    id: "usmle-step1",
    title: "USMLE Step 1 High-Yield Topics",
    category: "Medicine",
    description:
      "High-yield board review covering biochemistry, immunology, microbiology, pathology, pharmacology, physiology, and anatomy.",
    filename: "usmle-step1.md",
    itemCount: 95,
  },
  {
    id: "aws-saa",
    title: "AWS Solutions Architect Associate",
    category: "Technology",
    description:
      "SAA-C03 exam prep covering compute, storage, databases, networking, security, and the Well-Architected Framework.",
    filename: "aws-saa.md",
    itemCount: 85,
  },
  {
    id: "bar-exam",
    title: "Bar Exam MBE Essentials",
    category: "Law",
    description:
      "Multistate Bar Examination topics across constitutional law, contracts, torts, criminal law, evidence, real property, and civil procedure.",
    filename: "bar-exam.md",
    itemCount: 80,
  },
  {
    id: "cfa-level1",
    title: "CFA Level 1 Essentials",
    category: "Finance",
    description:
      "CFA Level 1 curriculum covering ethics, quantitative methods, economics, financial reporting, equity, fixed income, derivatives, and portfolio management.",
    filename: "cfa-level1.md",
    itemCount: 100,
  },
];

export async function GET() {
  return NextResponse.json(TEMPLATES);
}
