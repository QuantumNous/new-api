// @ts-nocheck
import { formatStreamPart } from 'not-ai';

const response = new Response(formatStreamPart('text', cached));
