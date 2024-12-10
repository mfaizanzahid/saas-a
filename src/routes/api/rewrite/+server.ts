import { json, error, fail, redirect  } from '@sveltejs/kit';
/** @type {import('./$types').RequestHandler} */

export async function POST({ request, locals: { getSession } }) {	
    
    const session = await getSession();

    if (!session) {
        console.log("NOT AUTHENTICATED")
        return json('PLEASE SIGN IN');
      
    }


    const { a, b } = await request.json();	
    
    return json(a + b);

}







// /** @type {import('./$types').RequestHandler} */

// export async function GET({ url, locals: { getSession } } ) {	

//     const session = await getSession();

//     if (!session) {
//         console.log("NOT AUTHENTICATED")
//       return {
//         status: 401,
//         body: { errorMessage: 'User not authenticated' },
//       };
      
//     }
    
    
//     const min = Number(url.searchParams.get('min') ?? '0');	
    
//     const max = Number(url.searchParams.get('max') ?? '1');
// 	const d = max - min;
	
    
//     if (isNaN(d) || d < 0) {		
        
//         error(400, 'min and max must be numbers, and min must be less than max');	
    
//     }
// 	const random = min + Math.random() * d;
// 	return new Response(String(random));}