// Post-processing function for outgoing responses

function postProcessResponse(req, resp) {
    logWithReq(req, 'Post-processing response with: ' + resp.statusCode);
}
